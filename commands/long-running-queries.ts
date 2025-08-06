import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args} from '@oclif/core'
import heredoc from 'tsheredoc'

export default class LongRunningQueries extends Command {
  static topic = 'pg'
  static description = 'show all queries longer than five minutes by descending duration'
  static hiddenAliases = ['long_running_queries']
  static args = {
    database: Args.string({description: 'database to run command against', required: false}),
  }

  static flags = {
    app: flags.app({required: true}),
  }

  private readonly query = heredoc(`
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

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(LongRunningQueries)
    const {app: appId} = flags
    const {database: attachmentId} = args

    const dbConnectionDetails = await utils.pg.fetcher.database(this.heroku, appId, attachmentId)
    const output = await utils.pg.psql.exec(dbConnectionDetails, this.query)
    process.stdout.write(output)
  }
}
