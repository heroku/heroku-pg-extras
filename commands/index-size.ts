import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args} from '@oclif/core'
import heredoc from 'tsheredoc'

export default class IndexSize extends Command {
  static topic = 'pg'
  static description = 'show the size of indexes, descending by size'
  static hiddenAliases = ['index_size']
  static args = {
    database: Args.string({description: 'database to run command against', required: false}),
  }

  static flags = {
    app: flags.app({required: true}),
    remote: flags.remote(),
  }

  private readonly query = heredoc(`
    SELECT c.relname AS name,
      pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size
    FROM pg_class c
    LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND n.nspname !~ '^pg_toast'
    AND c.relkind='i'
    GROUP BY c.relname
    ORDER BY sum(c.relpages) DESC;
  `)

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(IndexSize)
    const {app: appId} = flags
    const {database: attachmentId} = args

    const dbConnectionDetails = await utils.pg.fetcher.database(this.heroku, appId, attachmentId)
    const output = await utils.pg.psql.exec(dbConnectionDetails, this.query)
    process.stdout.write(output)
  }
}
