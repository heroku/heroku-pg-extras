import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args} from '@oclif/core'
import heredoc from 'tsheredoc'

export default class Blocking extends Command {
  static args = {
    database: Args.string({description: 'database to run command against', required: false}),
  }

  static description = 'display queries holding locks other queries are waiting to be released'

  static flags = {
    app: flags.app({required: true}),
    remote: flags.remote(),
  }

  private readonly query = heredoc.default`
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
  `

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Blocking)
    const {app: appId} = flags
    const {database: attachmentId} = args

    const dbConnectionDetails = await utils.pg.fetcher.database(this.heroku, appId, attachmentId)

    const output = await utils.pg.psql.exec(dbConnectionDetails, this.query)
    process.stdout.write(output)
  }
}
