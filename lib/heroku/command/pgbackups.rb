require "heroku/client/pgbackups"
require "heroku/command/base"
require "heroku/helpers/heroku_postgresql"

# reopen the Pgbackups class to add expose the direct transfer mechanism
class Heroku::Command::Pgbackups
  # pgbackups:transfer [DATABASE_FROM] DATABASE_TO
  #
  # -t, --to TO # a to value
  # -f, --from FROM # a from value
  #
  # transfer directly from the first database to the second
  #
  # if no DATABASE_FROM is specified, defaults to DATABASE_URL
  # the database backup is transferred directly to DATABASE_TO without an intermediate dump
  #
  def transfer
    destination_db = options[:to].nil? ? shift_argument : options[:to]
    source_db      = options[:from].nil? ? shift_argument : options[:from]

    if source_db.nil?
      source_db = "DATABASE_URL"
    end

    if destination_db.nil?
      error("pgbackups:transfer requires at least a destination database")
    end

    from_url, from_name = resolve_transfer(source_db)
    to_url, to_name = resolve_transfer(destination_db)

    validate_arguments!

    opts = {}

    if confirm_command(app, "Transfering data from #{from_name} to #{to_name}")
      backup = transfer!(from_url, from_name, to_url, to_name, opts)
      backup = poll_transfer!(backup)

      if backup["error_at"]
        message  =   "An error occurred and your backup did not finish."
        message += "\nThe database is not yet online. Please try again." if backup['log'] =~ /Name or service not known/
        message += "\nThe database credentials are incorrect."           if backup['log'] =~ /psql: FATAL:/
        error(message)
      end
    end
  end

  private

  # resolve the given database identifier
  def resolve_transfer(db)
    if /^postgres:/ =~ db
      uri = URI.parse(db)
      [url, "Database on #{uri.host}:#{uri.port || 5432}#{uri.path}"]
    else
      attachment = generate_resolver.resolve(db)
      [attachment.url, db.upcase]
    end
  end

  def generate_resolver
    app_name = app rescue nil # will raise if no app, but calling app reads in arguments
    Resolver.new(app_name, api)
  end
end
