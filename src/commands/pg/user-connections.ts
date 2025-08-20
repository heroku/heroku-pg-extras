'use strict'

import type {ConnectionDetailsWithAttachment} from '@heroku/heroku-cli-util'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export const generateUserConnectionsQuery = (): string => `SELECT 
  usename AS credential,
  count(*) AS connections
FROM pg_stat_activity 
WHERE state = 'active'
GROUP BY usename 
ORDER BY connections DESC;`.trim()

export default class PgUserConnections extends Command {
  static aliases = ['pg:user_connections']
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'returns the number of connections per credential'

  static flags = {
    app: flags.app({required: true}),
  }

  static needsAuth = true
  static preauth = true

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgUserConnections)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: ConnectionDetailsWithAttachment = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const output = await utils.pg.psql.exec(db, generateUserConnectionsQuery())
    ux.log(output)
  }
}
