'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export const generateIndexUsageQuery = (): string => `
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
`.trim()

export default class PgIndexUsage extends Command {
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'calculates your index hit rate (effective databases are at 99% and up)'

  static flags = {
    app: flags.app({required: true}),
  }

  static hiddenAliases = ['pg:index_usage']

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgIndexUsage)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbConnection = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const output = await utils.pg.psql.exec(dbConnection, generateIndexUsageQuery())
    ux.log(output)
  }
}
