'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export const generateBlockingQuery = (): string => `
SELECT bl.pid AS blocked_pid,
  ka.query AS blocking_statement,
  now() - ka.query_start AS blocking_duration,
  kl.pid AS blocking_pid,
  a.query AS blocked_statement,
  now() - a.query_start AS blocked_duration
FROM pg_catalog.pg_locks bl
JOIN pg_catalog.pg_stat_activity a
  ON bl.pid = a.pid
JOIN pg_catalog.pg_locks kl
  JOIN pg_catalog.pg_stat_activity ka
    ON kl.pid = ka.pid
ON bl.transactionid = kl.transactionid AND bl.pid != kl.pid
WHERE NOT bl.granted
`.trim()

export default class PgBlocking extends Command {
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'display queries holding locks other queries are waiting to be released'

  static flags = {
    app: flags.app({required: true}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgBlocking)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbConnection = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)
    const output = await utils.pg.psql.exec(dbConnection, generateBlockingQuery())
    ux.log(output)
  }
}
