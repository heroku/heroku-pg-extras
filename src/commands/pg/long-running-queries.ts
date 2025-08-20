'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export default class PgLongRunningQueries extends Command {
  static aliases = ['pg:long_running_queries']
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'show all queries longer than five minutes by descending duration'

  static flags = {
    app: flags.app({required: true}),
  }

<<<<<<< HEAD
  private readonly query = `
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query AS query
FROM
  pg_stat_activity
WHERE
  pg_stat_activity.query <> ''::text
  AND state <> 'idle'
  AND now() - pg_stat_activity.query_start > interval '5 minutes'
ORDER BY
  now() - pg_stat_activity.query_start DESC;
`
=======
  static needsAuth = true
  static preauth = true
>>>>>>> command-migrations-oclifv2-set2

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgLongRunningQueries)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbConnection = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const output = await utils.pg.psql.exec(dbConnection, this.query)
    ux.log(output)
  }
}
