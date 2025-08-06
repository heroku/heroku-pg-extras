// @ts-ignore
import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args} from '@oclif/core'
import heredoc from 'tsheredoc'

const truncatedQueryString = (prefix: string, truncate: boolean = false) => {
  const column = `${prefix}query`
  if (truncate) {
    return `CASE WHEN length(${column}) <= 40 THEN ${column} ELSE substr(${column}, 0, 39) || '…' END`
  } else {
    return column
  }
}

export default class Locks extends Command {
  static topic = 'pg'
  static description = 'display queries with active locks'
  static args = {
    database: Args.string({description: 'database to run command against', required: false}),
  }

  static flags = {
    app: flags.app({required: true}),
    truncate: flags.boolean({char: 't', description: 'truncates queries to 40 charaters'})
  }

  private readonly query = (truncate: boolean = false) => heredoc(`
    SELECT
      pg_stat_activity.pid,
      pg_class.relname,
      pg_locks.transactionid,
      pg_locks.granted,
      ${truncatedQueryString('pg_stat_activity.', truncate)} AS query_snippet,
      age(now(),pg_stat_activity.query_start) AS "age"
    FROM pg_stat_activity,pg_locks left
    OUTER JOIN pg_class
      ON (pg_locks.relation = pg_class.oid)
    WHERE pg_stat_activity.query <> '<insufficient privilege>'
      AND pg_locks.pid = pg_stat_activity.pid
      AND pg_locks.mode = 'ExclusiveLock'
      AND pg_stat_activity.pid <> pg_backend_pid() order by query_start;
  `)

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Locks)
    const {app: appId} = flags
    const {database: attachmentId} = args

    const dbConnectionDetails = await utils.pg.fetcher.database(this.heroku, appId, attachmentId)
    const output = await utils.pg.psql.exec(dbConnectionDetails, this.query(flags.truncate))
    process.stdout.write(output)
  }
}
