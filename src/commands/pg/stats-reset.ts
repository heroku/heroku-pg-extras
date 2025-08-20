'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

import {ensureEssentialTierPlan} from '../../lib/util'

export default class PgStatsReset extends Command {
  static aliases = ['pg:stats_reset']
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'calls the Postgres functions pg_stat_reset()'

  static flags = {
    app: flags.app({required: true}),
  }

  static needsAuth = true
  static preauth = true

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgStatsReset)
    const {app} = flags
    const {database} = args

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = await utils.pg.fetcher.database(this.heroku as any, app, database)
    await ensureEssentialTierPlan(db)

    // Get the database name from the connection details
    const {attachment: {addon: {name: dbName}}, host} = db

    const rsp = await this.heroku.put(`/client/v11/databases/${dbName}/stats_reset`, {host})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ux.log((rsp as any).message)
  }
}
