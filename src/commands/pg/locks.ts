'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export const generateLocksQuery = (truncate: boolean): string => {
  const querySnippet = truncate
    ? 'CASE WHEN length(pg_stat_activity.query) <= 40 THEN pg_stat_activity.query ELSE substr(pg_stat_activity.query, 0, 39) || \'...\' END'
    : 'pg_stat_activity.query'

  return `
  SELECT
    pg_stat_activity.pid,
    pg_class.relname,
    pg_locks.transactionid,
    pg_locks.granted,
    ${querySnippet} AS query_snippet,
    age(now(),pg_stat_activity.query_start) AS "age"
  FROM pg_stat_activity,pg_locks left
  OUTER JOIN pg_class
    ON (pg_locks.relation = pg_class.oid)
  WHERE pg_stat_activity.query <> '<insufficient privilege>'
    AND pg_locks.pid = pg_stat_activity.pid
    AND pg_locks.mode = 'ExclusiveLock'
    AND pg_stat_activity.pid <> pg_backend_pid() order by query_start;
  `.trim()
}

export default class PgLocks extends Command {
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'display queries with active locks'

  static flags = {
    app: flags.app({required: true}),
    truncate: flags.boolean({char: 't', description: 'truncates queries to 40 characters'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgLocks)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbConnection = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const output = await utils.pg.psql.exec(dbConnection, generateLocksQuery(flags.truncate))
    ux.log(output)
  }
}
