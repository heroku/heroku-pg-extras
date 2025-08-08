import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args} from '@oclif/core'
import heredoc from 'tsheredoc'

import {ensurePGStatStatement, newBlkTimeFields, newTotalExecTimeField} from '../../lib/util.js'

export default class Calls extends Command {
  static args = {
    database: Args.string({description: 'database to run command against', required: false}),
  }

  static description = 'show 10 queries that have highest frequency of execution'

  static flags = {
    app: flags.app({required: true}),
    remote: flags.remote(),
    truncate: flags.boolean({char: 't', description: 'truncate queries to 40 characters'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Calls)
    const {app: appId, truncate} = flags
    const {database: attachmentId} = args

    const dbConnectionDetails = await utils.pg.fetcher.database(this.heroku, appId, attachmentId)

    await ensurePGStatStatement(dbConnectionDetails)

    const truncatedQueryString = truncate
      ? 'CASE WHEN length(query) <= 40 THEN query ELSE substr(query, 0, 39) || \'…\' END'
      : 'query'

    const newTotalExecTimeFieldResult = await newTotalExecTimeField(dbConnectionDetails)
    let totalExecTimeField = ''
    if (newTotalExecTimeFieldResult) {
      totalExecTimeField = 'total_exec_time'
    } else {
      totalExecTimeField = 'total_time'
    }

    const newBlkTimeFieldsResult = await newBlkTimeFields(dbConnectionDetails)
    let blkReadField = ''
    let blkWriteField = ''
    if (newBlkTimeFieldsResult) {
      blkReadField = 'shared_blk_read_time'
      blkWriteField = 'shared_blk_write_time'
    } else {
      blkReadField = 'blk_read_time'
      blkWriteField = 'blk_write_time'
    }

    const query = heredoc.default`
SELECT interval '1 millisecond' * ${totalExecTimeField} AS total_exec_time,
to_char((${totalExecTimeField}/sum(${totalExecTimeField}) OVER()) * 100, 'FM90D0') || '%'  AS prop_exec_time,
to_char(calls, 'FM999G999G999G990') AS ncalls,
interval '1 millisecond' * (${blkReadField} + ${blkWriteField}) AS sync_io_time,
${truncatedQueryString} AS query
FROM pg_stat_statements WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user LIMIT 1)
ORDER BY calls DESC
LIMIT 10
`

    const output = await utils.pg.psql.exec(dbConnectionDetails, query)
    process.stdout.write(output)
  }
}
