'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

import {ensurePGStatStatement, newBlkTimeFields, newTotalExecTimeField} from '../../lib/util'

export const generateOutliersQuery = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  flags: {num?: number; truncate?: boolean}
): Promise<string> => {
  await ensurePGStatStatement(db)

  const truncatedQueryString = flags.truncate
    ? 'CASE WHEN length(query) <= 40 THEN query ELSE substr(query, 0, 39) || \'...\' END'
    : 'query'

  const limit = flags.num && flags.num > 0 ? flags.num : 10

  if (flags.num !== undefined && flags.num <= 0) {
    throw new Error(`Cannot parse num param value "${flags.num}" to a positive number`)
  }

  const newTotalExecTimeFieldResult = await newTotalExecTimeField(db)
  const totalExecTimeField = newTotalExecTimeFieldResult ? 'total_exec_time' : 'total_time'

  const newBlkTimeFieldsResult = await newBlkTimeFields(db)
  const blkReadField = newBlkTimeFieldsResult ? 'shared_blk_read_time' : 'blk_read_time'
  const blkWriteField = newBlkTimeFieldsResult ? 'shared_blk_write_time' : 'blk_write_time'

  return `
SELECT interval '1 millisecond' * ${totalExecTimeField} AS total_exec_time,
to_char((${totalExecTimeField}/sum(${totalExecTimeField}) OVER()) * 100, 'FM90D0') || '%'  AS prop_exec_time,
to_char(calls, 'FM999G999G999G990') AS ncalls,
interval '1 millisecond' * (${blkReadField} + ${blkWriteField}) AS sync_io_time,
${truncatedQueryString} AS query
FROM pg_stat_statements WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user LIMIT 1)
ORDER BY ${totalExecTimeField} DESC
LIMIT ${limit}
`.trim()
}

export default class PgOutliers extends Command {
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'show 10 queries that have longest execution time in aggregate'

  static flags = {
    app: flags.app({required: true}),
    num: flags.integer({char: 'n', description: 'the number of queries to display (default: 10)'}),
    reset: flags.boolean({description: 'resets statistics gathered by pg_stat_statements'}),
    truncate: flags.boolean({char: 't', description: 'truncate queries to 40 characters'}),
  }

  static needsAuth = true
  static preauth = true

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgOutliers)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    if (flags.reset) {
      await utils.pg.psql.exec(db, 'select pg_stat_statements_reset()')
      return
    }

    const query = await generateOutliersQuery(db, flags)
    const output = await utils.pg.psql.exec(db, query)
    ux.log(output)
  }
}
