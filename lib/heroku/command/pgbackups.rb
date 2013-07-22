require "heroku/client/pgbackups"
require "heroku/command/base"
require "heroku/helpers/heroku_postgresql"

module Heroku::Command

  # reopen the Pgbackups class to add expose the direct transfer mechanism
  Pgbackups.class_eval do

    # pgbackups:transfer [DATABASE_FROM] DATABASE_TO
    #
    # transfer directly from the first database to the second
    #
    # if no DATABASE_FROM is specified, defaults to DATABASE_URL
    # the database backup is transferred directly to DATABASE_TO without an intermediate dump
    #
    def transfer
      db1 = shift_argument
      db2 = shift_argument

      if db1.nil?
        error("pgbackups:transfer requires at least one argument")
      end

      if db2.nil?
        db2 = db1
        db1 = "DATABASE_URL"
      end

      from_url, from_name = resolve(db1, 'TRANSFER_FROM')
      to_url, to_name = resolve(db2, 'TRANSFER_TO')

      validate_arguments!

      opts      = {}

      backup = transfer!(from_url, from_name, to_url, to_name, opts)
      backup = poll_transfer!(backup)

      if backup["error_at"]
        message  =   "An error occurred and your backup did not finish."
        message += "\nThe database is not yet online. Please try again." if backup['log'] =~ /Name or service not known/
        message += "\nThe database credentials are incorrect."           if backup['log'] =~ /psql: FATAL:/
        error(message)
      end
    end

    private

    # resolve the given database identifier
    def resolve(db, default_name)
      if /^postgres:/ =~ db
        url = db
        name = default_name
      else
        attachment = if defined?(generate_resolver)
                       generate_resolver.resolve(db) # new resolver
                     else
                       hpg_resolve(db) # old resolver
                     end
        url = attachment.url
        name = db
      end
      [url, name]
    end

  end
end
