require "heroku/command/base"
require File.expand_path('lib/heroku/command/pgbackups', File.dirname(__FILE__))

class Heroku::Command::Pg < Heroku::Command::Base

  # pg:cache_hit [DATABASE]
  #
  # calculates your cache hit rate (effective databases are at 99% and up)
  #
  def cache_hit
    sql = %q(
      SELECT
        'index hit rate' AS name,
        (sum(idx_blks_hit)) / sum(idx_blks_hit + idx_blks_read) AS ratio
      FROM pg_statio_user_indexes
      UNION ALL
      SELECT
       'cache hit rate' AS name,
        sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) AS ratio
      FROM pg_statio_user_tables;
    )

    puts exec_sql(sql)
  end

  def cachehit
    puts "WARNING: pg:cachehit is deprecated. Use pg:cache_hit instead"
    cache_hit
  end

  # pg:index_usage [DATABASE]
  #
  # calculates your index hit rate (effective databases are at 99% and up)
  #
  def index_usage
    sql = %q(
      SELECT relname,
         CASE idx_scan
           WHEN 0 THEN 'Insufficient data'
           ELSE (100 * idx_scan / (seq_scan + idx_scan))::text
         END percent_of_times_index_used,
         n_live_tup rows_in_table
       FROM
         pg_stat_user_tables
       ORDER BY
         n_live_tup DESC;
    )
    puts exec_sql(sql)
  end

  def indexusage
    puts "WARNING: pg:indexusage is deprecated. Use pg:index_usage instead"
    index_usage
  end

  # pg:blocking [DATABASE]
  #
  # display queries holding locks other queries are waiting to be released
  #
  def blocking
    sql = %Q(
      SELECT bl.pid AS blocked_pid,
        ka.#{query_column} AS blocking_statement,
        now() - ka.query_start AS blocking_duration,
        kl.pid AS blocking_pid,
        a.#{query_column} AS blocked_statement,
        now() - a.query_start AS blocked_duration
      FROM pg_catalog.pg_locks bl
      JOIN pg_catalog.pg_stat_activity a
        ON bl.pid = a.#{pid_column}
      JOIN pg_catalog.pg_locks kl
        JOIN pg_catalog.pg_stat_activity ka
          ON kl.pid = ka.#{pid_column}
      ON bl.transactionid = kl.transactionid AND bl.pid != kl.pid
      WHERE NOT bl.granted
    )

   puts exec_sql(sql)
  end

  # pg:locks [DATABASE]
  #
  # display queries with active locks
  #
  def locks
    sql = %Q(
     SELECT
       pg_stat_activity.#{pid_column},
       pg_class.relname,
       pg_locks.transactionid,
       pg_locks.granted,
       substr(pg_stat_activity.#{query_column},1,30) AS query_snippet,
       age(now(),pg_stat_activity.query_start) AS "age"
     FROM pg_stat_activity,pg_locks left
     OUTER JOIN pg_class
       ON (pg_locks.relation = pg_class.oid)
     WHERE pg_stat_activity.#{query_column} <> '<insufficient privilege>' 
       AND pg_locks.pid = pg_stat_activity.#{pid_column}
       AND pg_locks.mode = 'ExclusiveLock' order by query_start;
    )

   puts exec_sql(sql)
  end

  # pg:ps [DATABASE]
  #
  # view active queries with execution time
  #
  def ps
    sql = %Q(
    SELECT
      #{pid_column},
      application_name AS source,
      age(now(),query_start) AS running_for,
      waiting,
      #{query_column} AS query
   FROM pg_stat_activity
   WHERE
     #{query_column} <> '<insufficient privilege>'
     #{
        if nine_two?
          "AND state <> 'idle'"
        else
          "AND current_query <> '<IDLE>'"
        end
     }
     AND #{pid_column} <> pg_backend_pid()
     ORDER BY query_start DESC
   )

    puts exec_sql(sql)
  end

  # pg:kill procpid [DATABASE]
  #
  # kill a query
  #
  # -f,--force  # terminates the connection in addition to cancelling the query
  #
  def kill
    procpid = shift_argument
    output_with_bang "procpid to kill is required" unless procpid && procpid.to_i != 0
    procpid = procpid.to_i

    cmd = options[:force] ? 'pg_terminate_backend' : 'pg_cancel_backend'
    sql = %Q(SELECT #{cmd}(#{procpid});)

    puts exec_sql(sql)
  end

  # pg:killall [DATABASE]
  #
  # terminates ALL connections
  #
  def killall
    sql = %Q(
      SELECT pg_terminate_backend(#{pid_column})
      FROM pg_stat_activity
      WHERE #{pid_column} <> pg_backend_pid()
      AND #{query_column} <> '<insufficient privilege>'
    )

    puts exec_sql(sql)
  end

  # pg:mandelbrot [DATABASE]
  #
  # show the mandelbrot set
  #
  def mandelbrot
    sql = %q(
      WITH RECURSIVE Z(IX, IY, CX, CY, X, Y, I) AS (
                SELECT IX, IY, X::float, Y::float, X::float, Y::float, 0
                FROM (select -2.2 + 0.031 * i, i from generate_series(0,101) as i) as xgen(x,ix),
                     (select -1.5 + 0.031 * i, i from generate_series(0,101) as i) as ygen(y,iy)
                UNION ALL
                SELECT IX, IY, CX, CY, X * X - Y * Y + CX AS X, Y * X * 2 + CY, I + 1
                FROM Z
                WHERE X * X + Y * Y < 16::float
                AND I < 100
          )
    SELECT array_to_string(array_agg(SUBSTRING(' .,,,-----++++%%%%@@@@#### ', LEAST(GREATEST(I,1),27), 1)),'')
    FROM (
          SELECT IX, IY, MAX(I) AS I
          FROM Z
          GROUP BY IY, IX
          ORDER BY IY, IX
         ) AS ZT
    GROUP BY IY
    ORDER BY IY
    )

    puts exec_sql(sql)
  end

  # pg:total_index_size [DATABASE]
  #
  # show the total size of the indexes in MB
  #
  def total_index_size
    sql = %q(
      SELECT pg_size_pretty(sum(relpages*8192)) AS size
      FROM pg_class
      WHERE reltype=0;
    )

    puts exec_sql(sql)
  end

  # pg:index_size [DATABASE]
  #
  # show the size of the indexes, descending by size
  #
  def index_size
    sql = %q(
      SELECT relname AS name,
        pg_size_pretty(sum(relpages*8192)) AS size
      FROM pg_class
      WHERE reltype=0
      GROUP BY relname
      ORDER BY sum(relpages) DESC;
    )

    puts exec_sql(sql)
  end

  # pg:unused_indexes [DATABASE]
  #
  # Show unused and almost unused indexes, ordered by their size relative to
  # the number of index scans. Exclude indexes of very small tables (less than
  # 5 pages), where the planner will almost invariably select a sequential
  # scan, but may not in the future as the table grows.
  #
  def unused_indexes
    sql = %q(
      SELECT
        schemaname || '.' || relname AS table,
        indexrelname AS index,
        pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
        idx_scan as index_scans
      FROM pg_stat_user_indexes ui
      JOIN pg_index i ON ui.indexrelid = i.indexrelid
      WHERE NOT indisunique AND idx_scan < 50 AND pg_relation_size(relid) > 5 * 8192
      ORDER BY pg_relation_size(i.indexrelid) / nullif(idx_scan, 0) DESC NULLS FIRST,
      pg_relation_size(i.indexrelid) DESC;
    )

    puts exec_sql(sql)
  end

  # pg:seq_scans [DATABASE]
  #
  # show the count of seq_scans by table descending by order
  #
  def seq_scans
    sql = %q(
      SELECT relname AS name,
             seq_scan as count
      FROM
        pg_stat_user_tables
      ORDER BY seq_scan DESC;
    )

    puts exec_sql(sql)
  end

  # pg:long_running_queries [DATABASE]
  #
  # show all queries taking longer than five minutes ordered by duration
  # descending
  #
  def long_running_queries
    sql = %Q(
      SELECT
        #{pid_column},
        now() - pg_stat_activity.query_start AS duration,
        #{query_column} AS query
      FROM
        pg_stat_activity
      WHERE
        pg_stat_activity.#{query_column} <> ''::text
        #{
          if nine_two?
            "AND state <> 'idle'"
          else
            "AND current_query <> '<IDLE>'"
          end
        }
        AND now() - pg_stat_activity.query_start > interval '5 minutes'
      ORDER BY
        now() - pg_stat_activity.query_start DESC;
    )

    puts exec_sql(sql)
  end

  # pg:bloat [DATABASE]
  #
  # show table and index bloat in your database ordered by most wasteful
  #
  def bloat
    sql = %q(
        SELECT
          tablename as table_name,
          ROUND(CASE WHEN otta=0 THEN 0.0 ELSE sml.relpages/otta::numeric END,1) AS table_bloat,
          CASE WHEN relpages < otta THEN '0' ELSE pg_size_pretty((bs*(sml.relpages-otta)::bigint)::bigint) END AS table_waste,
          iname as index_name,
          ROUND(CASE WHEN iotta=0 OR ipages=0 THEN 0.0 ELSE ipages/iotta::numeric END,1) AS index_bloat,
          CASE WHEN ipages < iotta THEN '0' ELSE pg_size_pretty((bs*(ipages-iotta))::bigint) END AS index_waste
        FROM (
          SELECT
            schemaname, tablename, cc.reltuples, cc.relpages, bs,
            CEIL((cc.reltuples*((datahdr+ma-
              (CASE WHEN datahdr%ma=0 THEN ma ELSE datahdr%ma END))+nullhdr2+4))/(bs-20::float)) AS otta,
            COALESCE(c2.relname,'?') AS iname, COALESCE(c2.reltuples,0) AS ituples, COALESCE(c2.relpages,0) AS ipages,
            COALESCE(CEIL((c2.reltuples*(datahdr-12))/(bs-20::float)),0) AS iotta -- very rough approximation, assumes all cols
          FROM (
            SELECT
              ma,bs,schemaname,tablename,
              (datawidth+(hdr+ma-(case when hdr%ma=0 THEN ma ELSE hdr%ma END)))::numeric AS datahdr,
              (maxfracsum*(nullhdr+ma-(case when nullhdr%ma=0 THEN ma ELSE nullhdr%ma END))) AS nullhdr2
            FROM (
              SELECT
                schemaname, tablename, hdr, ma, bs,
                SUM((1-null_frac)*avg_width) AS datawidth,
                MAX(null_frac) AS maxfracsum,
                hdr+(
                  SELECT 1+count(*)/8
                  FROM pg_stats s2
                  WHERE null_frac<>0 AND s2.schemaname = s.schemaname AND s2.tablename = s.tablename
                ) AS nullhdr
              FROM pg_stats s, (
                SELECT
                  (SELECT current_setting('block_size')::numeric) AS bs,
                  CASE WHEN substring(v,12,3) IN ('8.0','8.1','8.2') THEN 27 ELSE 23 END AS hdr,
                  CASE WHEN v ~ 'mingw32' THEN 8 ELSE 4 END AS ma
                FROM (SELECT version() AS v) AS foo
              ) AS constants
              GROUP BY 1,2,3,4,5
            ) AS foo
          ) AS rs
          JOIN pg_class cc ON cc.relname = rs.tablename
          JOIN pg_namespace nn ON cc.relnamespace = nn.oid AND nn.nspname = rs.schemaname AND nn.nspname <> 'information_schema'
          LEFT JOIN pg_index i ON indrelid = cc.oid
          LEFT JOIN pg_class c2 ON c2.oid = i.indexrelid
        ) AS sml
        ORDER BY CASE WHEN relpages < otta THEN 0 ELSE bs*(sml.relpages-otta)::bigint END DESC;
    )
    puts exec_sql(sql)
  end

  private

  def find_uri
    return @uri if defined? @uri

    attachment = hpg_resolve(shift_argument, "DATABASE_URL")
    if attachment.kind_of? Array
      uri = URI.parse( attachment.last )
    else
      uri = URI.parse( attachment.url )
    end

    @uri = uri
  end

  def version
    return @version if defined? @version
    @version = exec_sql("select version();").match(/PostgreSQL (\d+\.\d+\.\d+) on/)[1]
  end

  def nine_two?
    return @nine_two if defined? @nine_two
    @nine_two = Gem::Version.new(version) >= Gem::Version.new("9.2.0")
  end

  def pid_column
    if nine_two?
      'pid'
    else
      'procpid'
    end
  end

  def query_column
    if nine_two?
      'query'
    else
      'current_query'
    end
  end

  def exec_sql(sql)
    uri = find_uri
    begin
      ENV["PGPASSWORD"] = uri.password
      ENV["PGSSLMODE"]  = 'require'
      `psql -c "#{sql}" -U #{uri.user} -h #{uri.host} -p #{uri.port || 5432} #{uri.path[1..-1]}`
    rescue Errno::ENOENT
      output_with_bang "The local psql command could not be located"
      output_with_bang "For help installing psql, see https://devcenter.heroku.com/articles/heroku-postgresql#local-setup"
      abort
    end
  end
end
