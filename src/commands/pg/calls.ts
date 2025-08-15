'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'
const util = require('../../lib/util')

export default class PgCalls extends Command {
  static args = {
    database: Args.string({description: 'database name'}),
  }

  static description = 'show 10 queries that have highest frequency of execution'

  static flags = {
    app: flags.app({required: true}),
    remote: flags.remote({char: 'r'}),
    truncate: flags.boolean({char: 't', description: 'truncate queries to 40 characters'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgCalls)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbConnection = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    await util.ensurePGStatStatement(dbConnection)

    const truncatedQueryString = flags.truncate
      ? 'CASE WHEN length(query) <= 40 THEN query ELSE substr(query, 0, 39) || \'…\' END'
      : 'query'

    const newTotalExecTimeField = await util.newTotalExecTimeField(dbConnection)
    let totalExecTimeField = ''

    totalExecTimeField = newTotalExecTimeField ? 'total_exec_time' : 'total_time'

    const newBlkTimeFields = await util.newBlkTimeFields(dbConnection)
    let blkReadField = ''
    let blkWriteField = ''
    blkReadField = newBlkTimeFields ? 'shared_blk_read_time' : 'blk_read_time'
    blkWriteField = newBlkTimeFields ? 'shared_blk_write_time' : 'blk_write_time'

    const query = `
SELECT interval '1 millisecond' * ${totalExecTimeField} AS total_exec_time,
to_char((${totalExecTimeField}/sum(${totalExecTimeField}) OVER()) * 100, 'FM90D0') || '%'  AS prop_exec_time,
to_char(calls, 'FM999G999G999G990') AS ncalls,
interval '1 millisecond' * (${blkReadField} + ${blkWriteField}) AS sync_io_time,
${truncatedQueryString} AS query
FROM pg_stat_statements WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user LIMIT 1)
ORDER BY calls DESC
LIMIT 10
`

    const output = await utils.pg.psql.exec(dbConnection, query)
    ux.log(output)
  }
}
