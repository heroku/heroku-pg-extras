'use strict'

import { Command, flags } from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'
import {utils} from '@heroku/heroku-cli-util'

export default class PgCacheHit extends Command {
  static description = 'show index and table hit rate'
  static flags = {
    app: flags.app({required: true}),
    remote: flags.remote({char: 'r'}),
  }
  
  private readonly query = `
SELECT
  'index hit rate' AS name,
  (sum(idx_blks_hit)) / nullif(sum(idx_blks_hit + idx_blks_read),0) AS ratio
FROM pg_statio_user_indexes
UNION ALL
SELECT
 'table hit rate' AS name,
  sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read),0) AS ratio
FROM pg_statio_user_tables;
`

  static args = {
    database: Args.string({description: 'database name'}),
  }

  public async run(): Promise<void> {
    const {flags, args} = await this.parse(PgCacheHit)
    const dbConnection = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)
    const output = await utils.pg.psql.exec(dbConnection, this.query)
    ux.log(output)
  }
}
