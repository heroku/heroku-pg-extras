'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export const generateRecordsRankQuery = (): string => `
SELECT
  relname AS name,
  n_live_tup AS estimated_count
FROM
  pg_stat_user_tables
ORDER BY
  n_live_tup DESC;
`.trim()

export default class PgRecordsRank extends Command {
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'show all tables and the number of rows in each ordered by number of rows descending'

  static flags = {
    app: flags.app({required: true}),
  }

  static hiddenAliases = ['pg:records_rank']

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgRecordsRank)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const output = await utils.pg.psql.exec(db, generateRecordsRankQuery())
    ux.log(output)
  }
}
