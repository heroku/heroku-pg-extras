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
        'index hit rate' as name,
        (sum(idx_blks_hit)) / sum(idx_blks_hit + idx_blks_read) as ratio
      FROM pg_statio_user_indexes
      union all
      SELECT
       'cache hit rate' as name,
        sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
      FROM pg_statio_user_tables;)

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
  sql = %q(SELECT
         relname,
         CASE idx_scan
           WHEN 0 THEN 'Insufficient data'
           ELSE (100 * idx_scan / (seq_scan + idx_scan))::text
         END percent_of_times_index_used,
         n_live_tup rows_in_table
       FROM
         pg_stat_user_tables
       ORDER BY
         n_live_tup DESC;)
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
      select bl.pid as blocked_pid,
        ka.#{query_column} as blocking_statement,
        now() - ka.query_start as blocking_duration,
        kl.pid as blocking_pid,
        a.#{query_column} as blocked_statement,
        now() - a.query_start as blocked_duration
 from pg_catalog.pg_locks bl
      join pg_catalog.pg_stat_activity a
      on bl.pid = a.#{pid_column}
      join pg_catalog.pg_locks kl
           join pg_catalog.pg_stat_activity ka
           on kl.pid = ka.#{pid_column}
      on bl.transactionid = kl.transactionid and bl.pid != kl.pid
 where not bl.granted)

   puts exec_sql(sql)
  end

  # pg:locks [DATABASE]
  #
  # display queries with active locks
  #
  def locks
    sql = %Q(
   select
     pg_stat_activity.#{pid_column},
     pg_class.relname,
     pg_locks.transactionid,
     pg_locks.granted,
     substr(pg_stat_activity.#{query_column},1,30) as query_snippet,
     age(now(),pg_stat_activity.query_start) as "age"
   from pg_stat_activity,pg_locks left
     outer join pg_class on (pg_locks.relation = pg_class.oid)
   where pg_stat_activity.#{query_column} <> '<insufficient privilege>' and
      pg_locks.pid=pg_stat_activity.#{pid_column} and pg_locks.mode = 'ExclusiveLock' order by query_start)

   puts exec_sql(sql)
  end

  # pg:ps [DATABASE]
  #
  # view active queries with execution time
  #
  def ps
    sql = %Q(
    select
      #{pid_column},
      application_name as source,
      age(now(),query_start) as running_for,
      waiting,
      #{query_column} as query
   from pg_stat_activity
   where
     #{query_column} <> '<insufficient privilege>'
     #{
        if nine_two?
          "AND state <> 'idle'"
        else
          "AND current_query <> '<IDLE>'"
        end
     }
     and #{pid_column} <> pg_backend_pid()
   order by 3 desc
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
    sql = %Q(select #{cmd}(#{procpid});)

    puts exec_sql(sql)
  end

  # pg:mandelbrot [DATABASE]
  #
  # show the mandelbrot set
  #
  def mandelbrot
    sql = %q(WITH RECURSIVE Z(IX, IY, CX, CY, X, Y, I) AS (
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
      SELECT pg_size_pretty(sum(relpages*1024)) AS size
      FROM pg_class
      WHERE reltype=0;)

    puts exec_sql(sql)
  end

  # pg:index_size [DATABASE]
  #
  # show the size of the indexes, descending by size
  #
  def index_size
    sql = %q(
      SELECT relname AS name,
        pg_size_pretty(sum(relpages*1024)) AS size
      FROM pg_class
      WHERE reltype=0
      GROUP BY relname
      ORDER BY sum(relpages) DESC;)

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
	  WHERE NOT indisunique AND idx_scan < 50 AND (pg_relation_size(relid) / 1024 ) > 5
	  ORDER BY pg_relation_size(i.indexrelid) / nullif(idx_scan, 0) DESC NULLS FIRST,
	  pg_relation_size(i.indexrelid) DESC
	  ;)

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
      ORDER BY seq_scan DESC;)

    puts exec_sql(sql)
  end

  # pg:long_running_queries [DATABASE]
  #
  # show all queries taking longer than five minutes ordered by duration descending
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
        AND now() - pg_stat_activity.query_start > interval '5 minutes'
      ORDER BY
        now() - pg_stat_activity.query_start DESC;)

    puts exec_sql(sql)
  end

  # pg:bloat [DATABASE]
  #
  # show table and index bloat in your database ordered by most wasteful
  #
  def bloat
    sql = <<-END_SQL
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
      END_SQL
    puts exec_sql(sql)
  end

  # pg:push [DATABASE_FROM]
  #
  # Push Postgres database from specified URI to application's database
  def push
    db_from_uri = shift_argument
    if !db_from_uri
      output_with_bang "URI of database to push from is required"
      return
    end
    # pguri is assumed to be a pgconn URI, but we cannot assume that the psql
    # version in use accepts URIs, which were added in 9.2. For that reason,
    # perform conversion process to classic pgconn representation.
    pgconn_local = uri_s_to_conn(db_from_uri)
    app_uri = find_uri
    dbname = app_uri.path[1..-1]

    output_with_bang "WARNING: This is a destructive operation to application
database '#{dbname}' (#{app_uri.to_s}), which has as its largest tables the
following:"
    sql = <<-END_SQL
      SELECT
        pg_size_pretty(pg_relation_size(relid)) AS size,
        schemaname || '.' || relname AS table
      FROM pg_stat_user_tables
        ORDER BY pg_relation_size(relid)
      DESC LIMIT 5;
      END_SQL
    puts exec_sql(sql)
    confirm_db(dbname, app_uri.to_s)
    if db_fingerprints_equal(pgconn_local)
      output_with_bang "ERROR: FROM-DATABASE-URI and application database appear to be the same"
      return
    end
    # Restoring to app db
    pg_restore = gen_pg_restore_command(app_uri)
    pg_dump = gen_pg_dump_command(URI.parse(db_from_uri))

    system %{ #{pg_dump} | #{pg_restore} }

    verify_extensions_match(pgconn_local)
  end

  # pg:pull [DATABASE_TO]
  #
  # Pull application's Postgres database to a specificied Postgres URI
  def pull
    db_to_uri = shift_argument
    if !db_to_uri
      output_with_bang "URI of database to pull to is required"
      return
    end
    # pguri is assumed to be a URI, but we cannot assume that the psql version
    # in use accepts URIs. For that reason, perform conversion process to
    # classic pgconn representation.
    pgconn_local = uri_s_to_conn(db_to_uri)

    dbname = exec_local_sql(pgconn_local, "SELECT current_database();", true)
    output_with_bang "WARNING: This is a destructive operation to database
'#{dbname}' (#{db_to_uri}), which has as its largest tables the following:"
    sql = <<-END_SQL
      SELECT
        pg_size_pretty(pg_relation_size(relid)) AS size,
        schemaname || '.' || relname AS table
      FROM pg_stat_user_tables
        ORDER BY pg_relation_size(relid)
      DESC LIMIT 5;
      END_SQL
    puts exec_local_sql(pgconn_local, sql)
    confirm_db(dbname, db_to_uri)
    if db_fingerprints_equal(pgconn_local)
      output_with_bang "ERROR: TO-DATABASE-URI and application database appear to be the same"
      return
    end
    # restoring to local db
    app_uri = find_uri
    pg_restore = gen_pg_restore_command(URI.parse(db_to_uri))
    pg_dump = gen_pg_dump_command(app_uri)

    # XXX: Assume that it's sufficient to guard against psql not being
    # present; in practice, this almost always means that pg_dump and
    # pg_restore are also present.
    system %{ #{pg_dump} | #{pg_restore} }

    verify_extensions_match(pgconn_local)
  end

  private

  def db_fingerprints_equal(pgconn_local)
    # Compare fingerprints of local database with application database. This
    # is only going to indicate if two databases are equivalent according to
    # one narrow definition, but it is sufficient for almost all purposes.
    sql = "SELECT hashtext(array_agg(relname)::text) i FROM pg_class;"
    loc_exts = exec_local_sql(pgconn_local, sql)
    app_exts = exec_sql(sql)

    return loc_exts == app_exts
  end

  def verify_extensions_match(pgconn_local)
    if nine_one? && nine_one_local(pgconn_local)
      # It's pretty common for local DBs to not have extensions available that
      # are used by the remote app, so take the final precaution of warning if
      # the extensions available in the local database don't match. We don't
      # report it if the difference is solely in the version of an extension
      # used, though.
      ext_sql = "SELECT extname FROM pg_extension ORDER BY extname;"
      loc_exts = exec_local_sql(pgconn_local, ext_sql)
      app_exts = exec_sql(ext_sql)
      if loc_exts != app_exts
        output_with_bang "WARNING: Extensions in newly created database differ from existing application database."
        puts "Local extensions:"
        puts loc_exts
        puts "Application extensions:"
        puts app_exts
        output_with_bang "You should review output to ensure that any errors
ignored are acceptable - entire tables may have been missed, where a dependency
could not be resolved. You may need to to install a postgresql-contrib package
and retry."
      end
    end
  end

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

  def version_local(pgconn)
    return @version_local if defined? @version_local
    exec = exec_local_sql(pgconn, "select version();").match(/PostgreSQL (\d+\.\d+\.\d+) on/)
    # The version string doesn't alwasy reliably indicate version, as with
    # devel Postgres builds, so protect against this.
    if exec
      @version_local = exec[1]
    else
      @version_local = nil
    end
    return @version_local
  end

  def nine_one?
    return @nine_one if defined? @nine_one
    @nine_one = Gem::Version.new(version) >= Gem::Version.new("9.1.0")
  end

  def nine_one_local(pgconn)
    return Gem::Version.new(version_local(pgconn)) >= Gem::Version.new("9.1.0")
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

  def exec_local_sql(pgconn, sql, raw=false)
    begin
      if raw
        `PGSSLMODE=prefer psql -c "#{sql}" #{pgconn} -t`.strip()
      else
        `PGSSLMODE=prefer psql -c "#{sql}" #{pgconn}`
      end
    rescue Errno::ENOENT
      output_with_bang "The local psql command could not be located"
      output_with_bang "For help installing psql, see https://devcenter.heroku.com/articles/heroku-postgresql#local-setup"
      abort
    end
  end

  def uri_s_to_conn(pguri)
    uri = URI(pguri)
    pgconn = ""
    if uri.user
      pgconn += "-U #{uri.user} "
    end
    if uri.host
      pgconn += "-h #{uri.host} "
    end
    if uri.port
      pgconn += "-p #{uri.port} "
    end
    if uri.path
      pgconn += "#{uri.path[1..-1]}"
    end

    unless %w( postgres postgresql ).include? uri.scheme
      error <<-ERROR
Only PostgreSQL databases can be transferred with this command.
For information on transferring other database types, see:
https://devcenter.heroku.com/articles/import-data-heroku-postgres
      ERROR
    end

    return pgconn
  end

  def gen_pg_dump_command(uri)
    database = uri.path[1..-1] || "postgres"
    host = uri.host || "localhost"
    port = uri.port || "5432"
    user = uri.user ? "-U #{uri.user}" : ""
    # It is occasionally necessary to override PGSSLMODE, as when the server
    # wasn't built to support SSL.
    %{ env PGPASSWORD=#{uri.password} PGSSLMODE=prefer pg_dump --verbose -F c -h #{host} #{user} -p #{port} #{database} }
  end

  def gen_pg_restore_command(uri)
    database = uri.path[1..-1] || "postgres"
    host = uri.host || "localhost"
    port = uri.port || "5432"
    user = uri.user ? "-U #{uri.user}" : ""
    %{ env PGPASSWORD=#{uri.password} pg_restore --verbose --no-acl --no-owner #{user} -h #{host} -d #{database} -p #{port} }
  end

  def confirm_db(db_to_confirm, uri)
    display
    message ||= "WARNING: Destructive Action\nThis command will affect the database: #{db_to_confirm} (#{uri})"
    message << "\nTo proceed, type \"#{db_to_confirm}\""
    output_with_bang(message)
    display
    display "> ", false
    if ask.downcase != db_to_confirm
      error("Confirmation did not match #{db_to_confirm}. Aborted.")
    else
      true
    end
  end

end
