// @ts-ignore
import * as pg from '@heroku-cli/plugin-pg-v5'
import {Command, flags} from '@heroku-cli/command'
import {Args} from '@oclif/core'
import heredoc from 'tsheredoc'

export default class IndexUsage extends Command {
  static topic = 'pg'
  static description = 'calculates your index hit rate (effective databases are at 99% and up)'
  static hiddenAliases = ['index_usage']
  static flags = {
    app: flags.app({required: true}),
  }

  static args = {
    database: Args.string()
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(IndexUsage)
    const {app} = flags
    const {database} = args

    const query = heredoc(`
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
    `)
  
    const db = await pg.fetcher(this.heroku).database(app, database)
    const output = await pg.psql.exec(db, query)
    process.stdout.write(output)
  }
}
