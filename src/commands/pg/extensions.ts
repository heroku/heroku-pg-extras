'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'
const util = require('../../lib/util')

export default class PgExtensions extends Command {
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'list available and installed extensions'

  static flags = {
    app: flags.app({required: true}),
  }

  static needsAuth = true
  static preauth = true

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgExtensions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbConnection = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    if (util.essentialNumPlan(dbConnection.attachment.addon)) {
      const query = `SELECT *
                     FROM pg_available_extensions
                     WHERE name IN (SELECT unnest(string_to_array(current_setting('rds.allowed_extensions'), ',')))`

      const output = await utils.pg.psql.exec(dbConnection, query)
      ux.log(output)
    } else {
      const query = `SELECT *
                     FROM pg_available_extensions
                     WHERE name IN (SELECT unnest(string_to_array(current_setting('extwlist.extensions'), ',')))`
      const output = await utils.pg.psql.exec(dbConnection, query)
      ux.log(output)
    }
  }
}
