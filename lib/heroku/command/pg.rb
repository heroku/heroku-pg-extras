class Heroku::Command::Pg < Heroku::Command::Base
  module Hooks
    extend self
    def set_commands(shorthand)
      shorthand.gsub!(/[^A-Za-z0-9:_\-]/,'')

      aliases = [
        ["pg",  "heroku pg:psqlcommandhelper #{shorthand} "],
        ["fdw", "heroku pg:fdwsql "],
      ]

      #aliases.unshift ["help", "echo '#{aliases.map{|(name,_)| ":#{name}"}.join(', ') }'"]
      aliases.map{|(name,cmd)| '--set="' + name + '=\\\\! ' + cmd + '"'}.join(' ')
    end
  end

  # pg:psqlcommandhelper
  #
  # HIDDEN:
  def psqlcommandhelper
    app_db = shift_argument
    command = shift_argument

    if command == "help"
      exec "heroku help pg"
    else
      exec "heroku pg:#{command} #{app_db}"
    end
  end

  # pg:create-partitioning-sql duration timestamp_column
  #
  # HIDDEN:
  def create_partitioning_sql
    duration = shift_argument
    if duration.nil? || !['monthly', 'hourly', 'daily'].include?(duration)
      error("ERROR: Please specify a valid time duration for each snapshot.\nValid values:\n- hourly\n- daily\n- monthly")
    end
    unless ts_column = shift_argument
      error("ERROR: Please specify the name of the timestamp column in the target master table")
    end

    case duration
    when 'monthly'
      interval_name  = 'month'
      list_partition = "E'_(\\\\d{4})_(\\\\d{2})', E'\\\\1-\\\\2-01 00:00 UTC'"
      partition_format = 'YYYY_MM'
      num_of_seconds   = '30 * 24 * 60 * 60'
    when 'daily'
      interval_name  = 'day'
      list_partition = "E'_(\\\\d{4})_(\\\\d{2})_(\\\\d{2})', E'\\\\1-\\\\2-\\\\3 00:00 UTC'"
      partition_format = 'YYYY_MM_DD'
      num_of_seconds   = '24 * 60 * 60'
    when 'hourly'
      interval_name  = 'hour'
      list_partition = "E'_(\\\\d{4})_(\\\\d{2})_(\\\\d{2})t(\\\\d{2})', E'\\\\1-\\\\2-\\\\3 \\\\4:00 UTC'"
      partition_format = 'YYYY_MM_DDtHH24'
      num_of_seconds   = '60 * 60'
    end

    puts <<-SQL
-- partitioning
DROP TYPE IF EXISTS partition_info CASCADE;
CREATE TYPE partition_info AS (child_table regclass, start_ts timestamptz);

-- Lists all partitions of the given parent table as well
-- as the first timestamp they will accept. Assumes the naming
-- scheme used by add_partition.
CREATE OR REPLACE FUNCTION list_partitions(parent_table regclass)
  RETURNS SETOF partition_info AS $$
  SELECT
  pg_class.oid,
  regexp_replace(pg_class.oid::regclass::text, $1 || #{list_partition})::timestamptz as start_ts
  FROM
  pg_class INNER JOIN pg_inherits ON oid = inhrelid
  WHERE
  inhparent = $1
  ORDER BY
  1;
  $$ LANGUAGE SQL STABLE;

-- Returns time span covered by existing partitions that do
-- not yet have data.
CREATE OR REPLACE FUNCTION find_headroom(parent_table regclass)
  RETURNS interval AS $$
  SELECT coalesce(max(start_ts) - now(), interval '0 seconds') FROM list_partitions($1);
  $$ LANGUAGE SQL STABLE;

-- Adds a partition to the given table. The parent table INSERT
-- trigger should be rewritten after this is called.
CREATE OR REPLACE FUNCTION add_partition(parent_table regclass)
  RETURNS void AS $$
  DECLARE
  partition_start timestamptz;
  child_name text;
  child_ddl text;
  BEGIN
  SELECT coalesce(max(start_ts) + interval '1 #{interval_name}', date_trunc('#{interval_name}', now()))
  INTO partition_start FROM list_partitions(parent_table);
child_name := quote_ident(parent_table::text || '_' || to_char(partition_start at time zone 'UTC', '#{partition_format}'));
child_ddl := 'CREATE TABLE ' || child_name || ' (LIKE ' || quote_ident(parent_table::text) ||
               ' INCLUDING ALL, CHECK ( #{ts_column} >= ''' || partition_start || ''' AND #{ts_column} < timestamptz ''' ||
                 (partition_start + interval '1 #{interval_name}') || ''') ) INHERITS (' || quote_ident(parent_table::text) || ');';
EXECUTE child_ddl;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Drop the given partition. The parent table INSERT trigger should be
-- rewritten after this is called.
CREATE OR REPLACE FUNCTION drop_partition(child_table regclass)
  RETURNS void AS $$
  DECLARE
  BEGIN
  EXECUTE 'DROP TABLE ' || quote_ident(child_table::text);
  END;
  $$ LANGUAGE plpgsql VOLATILE;

  -- Rewrite the current partitioning insert trigger for the given parent table
  -- to account for all current child partitions
CREATE OR REPLACE FUNCTION rewrite_insert_trigger(parent_table regclass)
  RETURNS void AS $$
  DECLARE
  child_table regclass;
  start_ts timestamptz;
  quoted_parent text;
  trigger_name text;
  triggerfn_name text;
  triggerfn text;
  first_partition boolean := true;
  BEGIN
  quoted_parent := quote_ident(parent_table::text);
triggerfn_name := quote_ident(parent_table::text || '_insert_trigger');
trigger_name := quote_ident(parent_table::text || '_trigger');
triggerfn := 'CREATE OR REPLACE FUNCTION ' || triggerfn_name || '() RETURNS TRIGGER AS $trigger$
BEGIN
';

FOR child_table, start_ts IN SELECT * FROM list_partitions(parent_table) LOOP
IF first_partition THEN
triggerfn = triggerfn || '  IF';
first_partition := false;
ELSE
triggerfn = triggerfn || '  ELSIF';
END IF;
triggerfn = triggerfn || ' (NEW.#{ts_column} >= timestamptz ''' || start_ts ||
    ''' AND NEW.#{ts_column} < timestamptz ''' || start_ts + interval '1 #{interval_name}' || ''')
THEN INSERT INTO ' || quote_ident(child_table::text) || ' VALUES (NEW.*);
';
END LOOP;

triggerfn = triggerfn || '  ELSE RAISE EXCEPTION ''Date out of range. Check partitions'';
END IF;
RETURN NULL;
END;
$trigger$ LANGUAGE plpgsql;';
EXECUTE triggerfn;
-- TODO: is this necessary if the trigger already exists?
EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_name || ' ON ' || quoted_parent || ';';
EXECUTE 'CREATE TRIGGER ' || trigger_name ||
' BEFORE INSERT ON ' || quoted_parent ||
' FOR EACH ROW EXECUTE PROCEDURE ' || triggerfn_name || '();';
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Add child partitions to given table as necessary for the requisite
-- amount of 'headroom', drop partitions older than a certain time,
  -- and rewrite the INSERT trigger.
CREATE OR REPLACE FUNCTION massage_partitions(parent_table regclass, headroom interval, keep interval)
  RETURNS SETOF void AS $$
  SELECT
add_partition($1)
  FROM
  generate_series(1, ceil(((extract('epoch' from $2) -
            extract('epoch' from find_headroom($1))) / (#{num_of_seconds})))::integer) g
  UNION ALL
  SELECT
drop_partition(child_table)
  FROM
list_partitions($1)
  WHERE
  start_ts < now() - $3
  UNION ALL
  SELECT
  rewrite_insert_trigger($1);
  $$ LANGUAGE SQL VOLATILE;
SQL
  end

  # pg:fdwsql <prefix> <app::database>
  #
  # generate fdw install sql for database
  def fdwsql
    prefix = shift_argument
    db_id  = shift_argument
    unless [prefix,db_id].all?
      error("Usage fdwsql <prefix> <app::database>")
    end
    attachment = generate_resolver.resolve(db_id)
    uri = URI.parse(attachment.url)
    puts "CREATE EXTENSION IF NOT EXISTS postgres_fdw;"
    puts "DROP SERVER IF EXISTS #{prefix}_db;"
    puts "CREATE SERVER #{prefix}_db
            FOREIGN DATA WRAPPER postgres_fdw
            OPTIONS (dbname '#{uri.path[1..-1]}', host '#{uri.host}');"
    puts "CREATE USER MAPPING FOR CURRENT_USER
            SERVER #{prefix}_db
            OPTIONS (user '#{uri.user}', password '#{uri.password}');"

    table_sql = %Q(
      SELECT
        'CREATE FOREIGN TABLE '
        || quote_ident('#{prefix}_' || c.relname)
        || '(' || array_to_string(array_agg(quote_ident(a.attname) || ' ' || t.typname), ', ') || ') '
        || ' SERVER #{prefix}_db OPTIONS'
        || ' (schema_name ''' || quote_ident(n.nspname) || ''', table_name ''' || quote_ident(c.relname) || ''');'
      FROM
        pg_class     c,
        pg_attribute a,
        pg_type      t,
        pg_namespace n
      WHERE
        a.attnum > 0
        AND a.attrelid = c.oid
        AND a.atttypid = t.oid
        AND n.oid = c.relnamespace
        AND c.relkind in ('r', 'v')
        AND n.nspname <> 'pg_catalog'
        AND n.nspname <> 'information_schema'
        AND n.nspname !~ '^pg_toast'
        AND pg_catalog.pg_table_is_visible(c.oid)
      GROUP BY c.relname, n.nspname
      ORDER BY c.relname
      ;)
    result = exec_sql_on_uri(table_sql, uri)
    puts result.split(/\n/).grep(/CREATE/).join("\n")
    puts
  end

  # pg:fdw <list|unlink|link> <DATABASE>
  #
  #  Manage FDW links for <DATABASE>
  #  list   # List existing links
  #  unlink # Delete an existing link
  #    -l, --link <ID> # Link identifier
  #  link   # Create a new link
  #    -t, --target <TARGET> # Link target
  #
  def fdw
    mode = shift_argument || ''

    db = shift_argument
    if mode.nil? || !(%w[list unlink link].include?(mode))
      Heroku::Command.run(current_command, ["--help"])
      exit(1)
    end

    attachment = generate_resolver.resolve(db, "DATABASE_URL")

    case mode
    when 'list'
      response = hpg_client(attachment).fdw_list()
      if response.empty?
        output_with_bang("No links found for this database.")
      else
        styled_header(attachment.display_name)
        response.each do |link|
          display "\n==== #{link[:id]}"
          link[:created] = time_format(link[:created_at])
          link.reject! { |k,_| [:id, :created_at].include?(k) }
          styled_hash(Hash[link.map {|k, v| [humanize(k), v] }])
        end
      end
    when 'link'
      output_with_bang("No target specified.") if options[:target].nil?
      target = resolve_db_or_url(options[:target])
      response = hpg_client(attachment).fdw_set(target.url)
      display("New link successfully created.")
    when 'unlink'
      output_with_bang("No link specified.") if options[:link].nil?
      hpg_client(attachment).fdw_delete(options[:link])
      display("Link successfully removed.")
    end
  end

  # pg:cache-hit [DATABASE]
  #
  # calculates your cache hit rate (effective databases are at 99% and up)
  #
  def cache_hit
    sql = %q(
      SELECT
        'index hit rate' AS name,
        (sum(idx_blks_hit)) / nullif(sum(idx_blks_hit + idx_blks_read),0) AS ratio
      FROM pg_statio_user_indexes
      UNION ALL
      SELECT
       'table hit rate' AS name,
        sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read),0) AS ratio
      FROM pg_statio_user_tables;
    )

    track_extra('cache_hit') if can_track?
    puts exec_sql(sql)
  end

  alias_command "pg:cache-hit", "pg:cache_hit"

  # pg:index-usage [DATABASE]
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

    track_extra('index_usage') if can_track?
    puts exec_sql(sql)
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

    track_extra('blocking') if can_track?
    puts exec_sql(sql)
  end

  # pg:locks [DATABASE]
  #
  # display queries with active locks
  #
  #   -t, --truncate # truncates queries to 40 charaters
  #
  def locks
    sql = %Q(
     SELECT
       pg_stat_activity.#{pid_column},
       pg_class.relname,
       pg_locks.transactionid,
       pg_locks.granted,
       #{truncated_query_string("pg_stat_activity.")} AS query_snippet,
       age(now(),pg_stat_activity.query_start) AS "age"
     FROM pg_stat_activity,pg_locks left
     OUTER JOIN pg_class
       ON (pg_locks.relation = pg_class.oid)
     WHERE pg_stat_activity.#{query_column} <> '<insufficient privilege>'
       AND pg_locks.pid = pg_stat_activity.#{pid_column}
       AND pg_locks.mode = 'ExclusiveLock'
       AND pg_stat_activity.#{pid_column} <> pg_backend_pid() order by query_start;
    )

    track_extra('locks') if can_track?
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

    track_extra('mandelbrot') if can_track?
    puts exec_sql(sql)
  end

  # pg:total-index-size [DATABASE]
  #
  # show the total size of all indexes in MB
  #
  def total_index_size
    sql = %q(
      SELECT pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size
      FROM pg_class c
      LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname !~ '^pg_toast'
      AND c.relkind='i';
    )

    track_extra('total_index_size') if can_track?
    puts exec_sql(sql)
  end

  alias_command "pg:total-index-size", "pg:total_index_size"

  # pg:index-size [DATABASE]
  #
  # show the size of indexes, descending by size
  #
  def index_size
    sql = %q(
      SELECT c.relname AS name,
        pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size
      FROM pg_class c
      LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname !~ '^pg_toast'
      AND c.relkind='i'
      GROUP BY c.relname
      ORDER BY sum(c.relpages) DESC;
    )

    track_extra('index_size') if can_track?
    puts exec_sql(sql)
  end

  alias_command "pg:index-size", "pg:index_size"

  # pg:table-size [DATABASE]
  #
  # show the size of the tables (excluding indexes), descending by size
  #
  def table_size
    sql = %q(
      SELECT c.relname AS name,
        pg_size_pretty(pg_table_size(c.oid)) AS size
      FROM pg_class c
      LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname !~ '^pg_toast'
      AND c.relkind='r'
      ORDER BY pg_table_size(c.oid) DESC;
    )

    track_extra('table_size') if can_track?
    puts exec_sql(sql)
  end

  alias_command "pg:table-size", "pg:table_size"

  # pg:table-indexes-size [DATABASE]
  #
  # show the total size of all the indexes on each table, descending by size
  #
  def table_indexes_size
    sql = %q(
      SELECT c.relname AS table,
        pg_size_pretty(pg_indexes_size(c.oid)) AS index_size
      FROM pg_class c
      LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname !~ '^pg_toast'
      AND c.relkind='r'
      ORDER BY pg_indexes_size(c.oid) DESC;
    )

    track_extra('table_indexes_size') if can_track?
    puts exec_sql(sql)
  end

  alias_command "pg:table-indexes-size", "pg:table_indexes_size"

  # pg:total-table-size [DATABASE]
  #
  # show the size of the tables (including indexes), descending by size
  #
  def total_table_size
    sql = %q(
      SELECT c.relname AS name,
        pg_size_pretty(pg_total_relation_size(c.oid)) AS size
      FROM pg_class c
      LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname !~ '^pg_toast'
      AND c.relkind='r'
      ORDER BY pg_total_relation_size(c.oid) DESC;
    )

    track_extra('total_table_size') if can_track?
    puts exec_sql(sql)
  end

  alias_command "pg:total-table-size", "pg:total_table_size"

  # pg:unused-indexes [DATABASE]
  #
  # show unused and almost unused indexes, ordered by their size relative to
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

    track_extra('unused_indexes') if can_track?
    puts exec_sql(sql)
  end

  alias_command "pg:unused-indexes", "pg:unused_indexes"

  # pg:seq-scans [DATABASE]
  #
  # show the count of sequential scans by table descending by order
  #
  def seq_scans
    sql = %q(
      SELECT relname AS name,
             seq_scan as count
      FROM
        pg_stat_user_tables
      ORDER BY seq_scan DESC;
    )

    track_extra('seq_scans') if can_track?
    puts exec_sql(sql)
  end

  alias_command "pg:seq-scans", "pg:seq_scans"

  # pg:long-running-queries [DATABASE]
  #
  # show all queries longer than the given duration (5 minutes by default) by descending duration
  #
  #   -d, --duration <INTERVAL> # (optional) threshold in seconds or using interval syntax (e.g. '2 minutes')
  #
  def long_running_queries
    if duration = options[:duration]
      duration = "#{duration} seconds" if duration =~ /^\d+$/
    else
      duration = '5 minutes'
    end
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
        AND now() - pg_stat_activity.query_start > interval '#{duration}'
      ORDER BY
        now() - pg_stat_activity.query_start DESC;
    )

    track_extra('long_running_queries') if can_track?
    puts exec_sql(sql)
  end

  alias_command "pg:long-running-queries", "pg:long_running_queries"

  # pg:records_rank [DATABASE]
  #
  # show all tables and the number of rows in each ordered by number of rows descending
  #
  def records_rank
    sql = %Q(
      SELECT
        relname AS name,
        n_live_tup AS estimated_count
      FROM
        pg_stat_user_tables
      ORDER BY
        n_live_tup DESC;
    )

    track_extra('records_rank') if can_track?
    puts exec_sql(sql)
  end

  # pg:bloat [DATABASE]
  #
  # show table and index bloat in your database ordered by most wasteful
  #
  def bloat
    sql = %q(
        WITH constants AS (
          SELECT current_setting('block_size')::numeric AS bs, 23 AS hdr, 4 AS ma
        ), bloat_info AS (
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
            FROM pg_stats s, constants
            GROUP BY 1,2,3,4,5
          ) AS foo
        ), table_bloat AS (
          SELECT
            schemaname, tablename, cc.relpages, bs,
            CEIL((cc.reltuples*((datahdr+ma-
              (CASE WHEN datahdr%ma=0 THEN ma ELSE datahdr%ma END))+nullhdr2+4))/(bs-20::float)) AS otta
          FROM bloat_info
          JOIN pg_class cc ON cc.relname = bloat_info.tablename
          JOIN pg_namespace nn ON cc.relnamespace = nn.oid AND nn.nspname = bloat_info.schemaname AND nn.nspname <> 'information_schema'
        ), index_bloat AS (
          SELECT
            schemaname, tablename, bs,
            COALESCE(c2.relname,'?') AS iname, COALESCE(c2.reltuples,0) AS ituples, COALESCE(c2.relpages,0) AS ipages,
            COALESCE(CEIL((c2.reltuples*(datahdr-12))/(bs-20::float)),0) AS iotta -- very rough approximation, assumes all cols
          FROM bloat_info
          JOIN pg_class cc ON cc.relname = bloat_info.tablename
          JOIN pg_namespace nn ON cc.relnamespace = nn.oid AND nn.nspname = bloat_info.schemaname AND nn.nspname <> 'information_schema'
          JOIN pg_index i ON indrelid = cc.oid
          JOIN pg_class c2 ON c2.oid = i.indexrelid
        )
        SELECT
          type, schemaname, object_name, bloat, pg_size_pretty(raw_waste) as waste
        FROM
        (SELECT
          'table' as type,
          schemaname,
          tablename as object_name,
          ROUND(CASE WHEN otta=0 THEN 0.0 ELSE table_bloat.relpages/otta::numeric END,1) AS bloat,
          CASE WHEN relpages < otta THEN '0' ELSE (bs*(table_bloat.relpages-otta)::bigint)::bigint END AS raw_waste
        FROM
          table_bloat
            UNION
        SELECT
          'index' as type,
          schemaname,
          tablename || '::' || iname as object_name,
          ROUND(CASE WHEN iotta=0 OR ipages=0 THEN 0.0 ELSE ipages/iotta::numeric END,1) AS bloat,
          CASE WHEN ipages < iotta THEN '0' ELSE (bs*(ipages-iotta))::bigint END AS raw_waste
        FROM
          index_bloat) bloat_summary
        ORDER BY raw_waste DESC, bloat DESC
    )
    track_extra('bloat') if can_track?
    puts exec_sql(sql)
  end

  # pg:vacuum-stats [DATABASE]
  #
  # show dead rows and whether an automatic vacuum is expected to be triggered
  #
  def vacuum_stats
    sql = %q(
      WITH table_opts AS (
        SELECT
          pg_class.oid, relname, nspname, array_to_string(reloptions, '') AS relopts
        FROM
           pg_class INNER JOIN pg_namespace ns ON relnamespace = ns.oid
      ), vacuum_settings AS (
        SELECT
          oid, relname, nspname,
          CASE
            WHEN relopts LIKE '%autovacuum_vacuum_threshold%'
              THEN regexp_replace(relopts, '.*autovacuum_vacuum_threshold=([0-9.]+).*', E'\\\\\\1')::integer
              ELSE current_setting('autovacuum_vacuum_threshold')::integer
            END AS autovacuum_vacuum_threshold,
          CASE
            WHEN relopts LIKE '%autovacuum_vacuum_scale_factor%'
              THEN regexp_replace(relopts, '.*autovacuum_vacuum_scale_factor=([0-9.]+).*', E'\\\\\\1')::real
              ELSE current_setting('autovacuum_vacuum_scale_factor')::real
            END AS autovacuum_vacuum_scale_factor
        FROM
          table_opts
      )
      SELECT
        vacuum_settings.nspname AS schema,
        vacuum_settings.relname AS table,
        to_char(psut.last_vacuum, 'YYYY-MM-DD HH24:MI') AS last_vacuum,
        to_char(psut.last_autovacuum, 'YYYY-MM-DD HH24:MI') AS last_autovacuum,
        to_char(pg_class.reltuples, '9G999G999G999') AS rowcount,
        to_char(psut.n_dead_tup, '9G999G999G999') AS dead_rowcount,
        to_char(autovacuum_vacuum_threshold
             + (autovacuum_vacuum_scale_factor::numeric * pg_class.reltuples), '9G999G999G999') AS autovacuum_threshold,
        CASE
          WHEN autovacuum_vacuum_threshold + (autovacuum_vacuum_scale_factor::numeric * pg_class.reltuples) < psut.n_dead_tup
          THEN 'yes'
        END AS expect_autovacuum
      FROM
        pg_stat_user_tables psut INNER JOIN pg_class ON psut.relid = pg_class.oid
          INNER JOIN vacuum_settings ON pg_class.oid = vacuum_settings.oid
      ORDER BY 1
    )
    track_extra('vacuum_stats') if can_track?
    puts exec_sql(sql)
  end

  alias_command "pg:vacuum-stats", "pg:vacuum_stats"

  # pg:extensions [DATABASE]
  #
  # list available and installed extensions.
  #
  def extensions
    track_extra('extensions') if can_track?
    puts exec_sql("SELECT * FROM pg_available_extensions WHERE name IN (SELECT unnest(string_to_array(current_setting('extwlist.extensions'), ',')))")
  end

  # pg:outliers [DATABASE]
  #
  # show 10 queries that have longest execution time in aggregate.
  #
  #   --reset        # resets statistics gathered by pg_stat_statements
  #                  # which powers pg:outliers
  #   -t, --truncate # truncates queries to 40 charaters
  #
  def outliers
    unless pg_stat_statement?
      puts "pg_stat_statements extension need to be installed in the public schema first."
      puts "This extension is only available on Postgres versions 9.2 or greater. You can install it by running:"
      puts "\n\tCREATE EXTENSION pg_stat_statements;\n\n"
      return
    end

    if options[:reset]
      sql = "select pg_stat_statements_reset()"
      action "Resetting pg_stat_statements" do
        exec_sql(sql)
      end
      return
    end

    sql = %Q(
        SELECT #{truncated_query_string} AS qry,
        interval '1 millisecond' * total_time AS total_exec_time,
        to_char((total_time/sum(total_time) OVER()) * 100, 'FM90D0') || '%'  AS prop_exec_time,
        to_char(calls, 'FM999G999G999G990') AS ncalls,
        interval '1 millisecond' * (blk_read_time + blk_write_time) AS sync_io_time
        FROM pg_stat_statements WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user LIMIT 1)
        ORDER BY total_time DESC LIMIT 10
    )
    track_extra('outliers') if can_track?
    puts exec_sql(sql)
  end

  # pg:calls [DATABASE]
  #
  # show 10 most frequently called queries.
  #
  #   -t, --truncate # truncates queries to 40 charaters
  #
  def calls
    unless pg_stat_statement?
      puts "pg_stat_statements extension need to be installed in the public schema first."
      puts "This extension is only available on Postgres versions 9.2 or greater. You can install it by running:"
      puts "\n\tCREATE EXTENSION pg_stat_statements;\n\n"
      return
    end
    sql = %Q(
        SELECT #{truncated_query_string} AS qry,
        interval '1 millisecond' * total_time AS exec_time,
        to_char((total_time/sum(total_time) OVER()) * 100, 'FM90D0') || '%'  AS prop_exec_time,
        to_char(calls, 'FM999G999G990') AS ncalls,
        interval '1 millisecond' * (blk_read_time + blk_write_time) AS sync_io_time
        FROM pg_stat_statements WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user LIMIT 1)
        ORDER BY calls DESC LIMIT 10
    )
    track_extra('calls') if can_track?
    puts exec_sql(sql)
  end

  # pg:incidents [DATABASE]
  #
  # show recents incidents.
  #
  def incidents
    db = shift_argument
    attachment = generate_resolver.resolve(db, "DATABASE_URL")
    validate_arguments!

    incidents = hpg_client(attachment).incidents
    if incidents.empty?
      output_with_bang("No incidents found for this database.")
    elsif incidents.is_a?(Hash) && incidents.has_key?(:message)
      output_with_bang(incidents[:message])
    else
      styled_header(attachment.display_name)
      incidents.each do |incident|
        display "\n==== #{time_format(incident[:created_at])}"
        incident[:duration] = format_duration(incident[:created_at], incident[:updated_at])
        incident[:duration] += " (ongoing)" if incident[:ongoing]
        incident.reject! { |k,_| [:id, :updated_at, :created_at, :ongoing].include?(k) }
        styled_hash(Hash[incident.map {|k, v| [humanize(k), v] }])
      end
    end
  end

  private

  def pg_stat_statement?
    return false if version.to_f < 9.1

    @statements ||= exec_sql(<<-EOF).include?("t")
    SELECT exists(
        SELECT 1 FROM pg_extension where extname = 'pg_stat_statements'
    ) AS available
EOF
  end

  def can_track?
    require 'yaml'
    config_file = File.join(ENV['HOME'], '.heroku', 'pg-extras.conf')
    if File.exists? config_file
      consent = YAML.load_file(config_file)[:collect_stats]
    else
      message = %Q{Hello! We at Heroku would like to track your usage of pg-extras.
This data helps us direct our efforts in supporting and adopting the
features used here. All data is anonymous; we only collect the command name,
nothing else.

Please answer (y/n) if this is OK. A file is written to #{config_file} recording
your reply. Default is "no".
}
      output_with_bang("Attention!")
      agreement = confirm("#{message} (n/y):")
      File.open(config_file, 'w') { |file| YAML::dump({:collect_stats => agreement},file) }
      consent = agreement
    end
    consent
  end

  def track_extra(command)
    Thread.new do
      uri = URI.parse("https://pg-extras-stats.herokuapp.com/command")
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true

      params = {'command' => command}
      request = Net::HTTP::Post.new(uri.request_uri, params)
      request.set_form_data(params)

      http.request(request)
    end
  end

  def resolve_db_or_url(name_or_url, default=nil)
    if name_or_url =~ %r{(postgres://|redis://)}
      url = name_or_url
      uri = URI.parse(url)
      name = url_name(uri)
      MaybeAttachment.new(name, url, nil)
    else
      attachment = generate_resolver.resolve(name_or_url, default)
      name = attachment.config_var.sub(/^HEROKU_(POSTGRESQL|REDIS)_/, '').sub(/_URL$/, '')
      MaybeAttachment.new(name, attachment.url, attachment)
    end
  end

  def in_maintenance?(app)
    api.get_app_maintenance(app).body['maintenance']
  end

  def time_format(time)
    Time.parse(time).getutc.strftime("%Y-%m-%d %H:%M %Z")
  end

  def format_duration(start, stop)
    start = Time.parse(start)
    stop = Time.parse(stop)

    seconds = (stop - start).to_i
    minutes = seconds / 60
    hours = minutes / 60
    days = hours / 24

    if days > 0
      "#{days} days #{hours % 24} hours"
    elsif hours > 0
      "#{hours} hours #{minutes % 60} minutes"
    elsif minutes > 0
      "#{minutes} minutes #{seconds % 60} seconds"
    elsif seconds >= 0
      "#{seconds} seconds"
    end
  end

  def humanize(key)
    key.to_s.gsub(/_/, ' ').split(" ").map(&:capitalize).join(" ")
  end

  def truncated_query_string(prefix=nil)
    column = "#{prefix}#{query_column}"
    if options[:truncate]
      "CASE WHEN length(#{column}) < 40 THEN #{column} ELSE substr(#{column}, 0, 38) || '..' END"
    else
      column
    end
  end
end

