'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export const generateSeqScansQuery = (): string => `
SELECT relname AS name,
       seq_scan as count
FROM
  pg_stat_user_tables
ORDER BY seq_scan DESC;
`.trim()

export default class PgSeqScans extends Command {
  static hiddenAliases = ['pg:seq_scans']
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'show the count of sequential scans by table descending by order'

  static flags = {
    app: flags.app({required: true}),
  }

  static needsAuth = true
  static preauth = true

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgSeqScans)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const output = await utils.pg.psql.exec(db, generateSeqScansQuery())
    ux.log(output)
  }
}
