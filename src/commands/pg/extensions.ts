'use strict'

import {type ConnectionDetailsWithAttachment, utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

import * as util from '../../lib/util'

export function generateExtensionsQuery(dbConnection: ConnectionDetailsWithAttachment): string {
  return util.essentialNumPlan(dbConnection.attachment.addon)
    ? `SELECT *
                     FROM pg_available_extensions
                     WHERE name IN (SELECT unnest(string_to_array(current_setting('rds.allowed_extensions'), ',')))`
    : `SELECT *
                     FROM pg_available_extensions
                     WHERE name IN (SELECT unnest(string_to_array(current_setting('extwlist.extensions'), ',')))`
}

export default class PgExtensions extends Command {
  static args = {
    database: Args.string({description: 'database name'}),
  }

  static description = 'list available and installed extensions'

  static flags = {
    app: flags.app({required: true}),
    remote: flags.remote({char: 'r'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgExtensions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbConnection = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const query = generateExtensionsQuery(dbConnection)
    const output = await utils.pg.psql.exec(dbConnection, query)
    ux.log(output)
  }
}
