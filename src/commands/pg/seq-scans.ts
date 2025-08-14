'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export default class PgSeqScans extends Command {
  static args = {
    database: Args.string({description: 'database name'}),
  }

  static description = 'show the count of sequential scans by table descending by order'

  static flags = {
    app: flags.app({required: true}),
    remote: flags.remote({char: 'r'}),
  }

  private readonly query = `
SELECT relname AS name,
       seq_scan as count
FROM
  pg_stat_user_tables
ORDER BY seq_scan DESC;
`

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgSeqScans)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const output = await utils.pg.psql.exec(db, this.query)
    ux.log(output)
  }
}
