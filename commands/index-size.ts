// @ts-ignore
import * as pg from '@heroku-cli/plugin-pg-v5'
import {Command, flags} from '@heroku-cli/command'
import {Args} from '@oclif/core'
import heredoc from 'tsheredoc'

export default class IndexSize extends Command {
  static topic = 'pg'
  static description = 'show the size of indexes, descending by size'
  static hiddenAliases = ['index_size']
  static flags = {
    app: flags.app({required: true}),
  }

  static args = {
    database: Args.string()
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(IndexSize)
    const {app} = flags
    const {database} = args

    const query = heredoc(`
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

    const db = await pg.fetcher(this.heroku).database(app, database)
    const output = await pg.psql.exec(db, query)
    process.stdout.write(output)
  }
}
