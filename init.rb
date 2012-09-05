require "heroku/command/base"

class Heroku::Command::Pg < Heroku::Command::Base
  # pg:ps [database]
  #
  # see what's goin' on
  #
  def ps
    sql = %q(
    select
      procpid,
      application_name as source,
      (now()-query_start)::interval as running_for,
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
