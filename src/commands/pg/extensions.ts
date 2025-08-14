'use strict'

import { Command, flags } from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'
import {utils} from '@heroku/heroku-cli-util'
const util = require('../../lib/util')

export default class PgExtensions extends Command {
  static description = 'list available and installed extensions'
  static flags = {
    app: flags.app({required: true}),
    remote: flags.remote({char: 'r'}),
  }
  
  static args = {
    database: Args.string({description: 'database name'}),
  }

  public async run(): Promise<void> {
    const {flags, args} = await this.parse(PgExtensions)
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
