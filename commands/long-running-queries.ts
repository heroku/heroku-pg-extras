// @ts-ignore
import * as pg from '@heroku-cli/plugin-pg-v5'
import {Command, flags} from '@heroku-cli/command'
import {Args} from '@oclif/core'
import heredoc from 'tsheredoc'

export default class LongRunningQueries extends Command {
  static topic = 'pg'
  static description = 'show all queries longer than five minutes by descending duration'
  static hiddenAliases = ['long_running_queries']
  static flags = {
    app: flags.app({required: true}),
  }

  static args = {
    database: Args.string()
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(LongRunningQueries)
    const {app} = flags
    const {database} = args

    const query = heredoc(`
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
    `)

    const db = await pg.fetcher(this.heroku).database(app, database)
    const output = await pg.psql.exec(db, query)
    process.stdout.write(output)
  }
}
