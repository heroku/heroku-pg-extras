require "heroku/command/base"

class Heroku::Command::Pg < Heroku::Command::Base

  def cachehit
  # pg:cachehit
  # 
  # see your cache hit rate for your database (effective databases are at 99% and up)
  # 
  sql = %q(SELECT 
        to_char((sum(idx_blks_hit) - sum(idx_blks_read)) / sum(idx_blks_hit), '99.99') as cache_hit_rate 
      FROM 
        pg_statio_user_indexes)
    exec_sql(sql, find_uri)
  end
  # pg:blocking [database]
  #
  # see what queries are blocking your queries
  #
  def blocking
    sql = %q(
      select bl.pid as blocked_pid,
        ka.current_query as blocking_statement,
        now() - ka.query_start as blocking_duration,
        kl.pid as blocking_pid,
        a.current_query as blocked_statement,
        now() - a.query_start as blocked_duration
 from pg_catalog.pg_locks bl
      join pg_catalog.pg_stat_activity a
      on bl.pid = a.procpid
      join pg_catalog.pg_locks kl
           join pg_catalog.pg_stat_activity ka
           on kl.pid = ka.procpid
      on bl.transactionid = kl.transactionid and bl.pid != kl.pid
 where not bl.granted)

   exec_sql(sql, find_uri)
  end

  # pg:locks [database]
  #
  # see what locks are held by what
  #
  def locks
    sql = %q(
   select
     pg_stat_activity.procpid,
     pg_class.relname,
     pg_locks.transactionid,
     pg_locks.granted,
     substr(pg_stat_activity.current_query,1,30) as query_snippet,
     age(now(),pg_stat_activity.query_start) as "age"
   from pg_stat_activity,pg_locks left
     outer join pg_class on (pg_locks.relation = pg_class.oid)
   where pg_stat_activity.current_query <> '<insufficient privilege>' and
      pg_locks.pid=pg_stat_activity.procpid and pg_locks.mode = 'ExclusiveLock' order by query_start)

   exec_sql(sql, find_uri)
  end

  # pg:ps [database]
  #
  # see what's goin' on
  #
  def ps
    sql = %q(
    select
      procpid,
      application_name as source,
      age(now(),query_start) as running_for,
      waiting,
      current_query as query
   from pg_stat_activity
   where
     current_query <> '<insufficient privilege>'
     AND current_query <> '<IDLE>'
     and procpid <> pg_backend_pid()
   order by 3 desc
   )

    exec_sql(sql, find_uri)
  end

  # pg:kill procpid [database]
  #
  # kill a query
  #
  # -f,--force  # really kill a query
  #
  def kill
    procpid = shift_argument
    output_with_bang "procpid must be a procpid" unless procpid && procpid.to_i != 0
    procpid = procpid.to_i

    cmd = options[:force] ? 'pg_terminate_backend' : 'pg_cancel_backend'
    sql = %Q(select #{cmd}(#{procpid});)

    exec_sql(sql, find_uri)
  end

  # pg:mandelbrot [database]
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

    exec_sql(sql, find_uri)
  end

  def find_uri
    attachment = hpg_resolve(shift_argument, "DATABASE_URL")
    if attachment.kind_of? Array
      uri = URI.parse( attachment.last )
    else
      uri = URI.parse( attachment.url )
    end
    uri
  end

  def exec_sql(sql, uri)
    begin
      ENV["PGPASSWORD"] = uri.password
      ENV["PGSSLMODE"]  = 'require'
      exec %Q(psql -c "#{sql}" -U #{uri.user} -h #{uri.host} -p #{uri.port || 5432} #{uri.path[1..-1]})
    rescue Errno::ENOENT
      output_with_bang "The local psql command could not be located"
      output_with_bang "For help installing psql, see http://devcenter.heroku.com/articles/local-postgresql"
      abort
    end
  end
end
