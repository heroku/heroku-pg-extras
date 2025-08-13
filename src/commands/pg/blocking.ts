import {Command, Flags, Args} from '@oclif/core'
import heredoc from 'tsheredoc'

export default class Blocking extends Command {
  static description = 'display queries holding locks other queries are waiting to be released'

  static examples = [
    '$ heroku pg:blocking',
    '$ heroku pg:blocking DATABASE',
  ]

  static args = {
    database: Args.string({
      description: 'database to run command against',
      required: false,
    }),
  }

  static flags = {
    app: Flags.string({
      char: 'a',
      description: 'app to run command against',
      required: true,
    }),
    remote: Flags.string({
      char: 'r',
      description: 'git remote of app to use',
    }),
  }

  private readonly query = heredoc`
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

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Blocking)
    const {app: appId} = flags
    const {database: attachmentId} = args

    // For now, we'll need to implement the database connection logic
    // This is a placeholder - you'll need to implement the actual database connection
    // using the appropriate Heroku CLI utilities for oclif v4+
    
    this.log('Database blocking analysis would run here')
    this.log(`App: ${appId}`)
    this.log(`Database: ${attachmentId || 'default'}`)
    this.log('Query:', this.query)
    
    // TODO: Implement actual database connection and query execution
    // This requires integrating with Heroku CLI utilities in oclif v4+ format
  }
}
