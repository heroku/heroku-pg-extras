'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'
import {ensureEssentialTierPlan} from '../../lib/util'

export default class PgStatsReset extends Command {
  static args = {
    database: Args.string({description: 'database name'}),
  }

  static description = 'calls the Postgres functions pg_stat_reset()'

  static flags = {
    app: flags.app({required: true}),
    remote: flags.remote({char: 'r'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgStatsReset)
    const app = flags.app
    const {database} = args

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = await utils.pg.fetcher.database(this.heroku as any, app, database)
    await ensureEssentialTierPlan(db)
    
    // Get the database name from the connection details
    const dbName = db.attachment.addon.name
    const host = db.host
    
    const rsp = await this.heroku.put(`/client/v11/databases/${dbName}/stats_reset`, {host})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ux.log((rsp as any).message)
  }
}
