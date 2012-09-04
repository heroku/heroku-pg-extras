require "heroku/command/base"

class Heroku::Command::Pg < Heroku::Command::Base
  # pg:ps
  #
  # see what's goin' on
  #
  #
  def ps
    attachment = hpg_resolve(shift_argument, "DATABASE_URL")
    if attachment.kind_of? Array
      uri = URI.parse( attachment.last )
    else
      uri = URI.parse( attachment.url )
    end

    cmd = %q(
    select
      procpid,
      application_name as source,
      (now()-query_start)::interval as running_for,
      waiting,
      current_query as query
   from pg_stat_activity
   where
     current_query <> '<insufficient privilege>'
     and procpid <> pg_backend_pid()
   order by 3 desc
   )

    begin
      ENV["PGPASSWORD"] = uri.password
      ENV["PGSSLMODE"]  = 'require'
      exec %Q(psql -c "#{cmd}" -U #{uri.user} -h #{uri.host} -p #{uri.port || 5432} #{uri.path[1..-1]})
    rescue Errno::ENOENT
      output_with_bang "The local psql command could not be located"
      output_with_bang "For help installing psql, see http://devcenter.heroku.com/articles/local-postgresql"
      abort
    end
  end
end
