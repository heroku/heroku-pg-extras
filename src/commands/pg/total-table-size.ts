'use strict'

import type {ConnectionDetailsWithAttachment} from '@heroku/heroku-cli-util'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export const generateTotalTableSizeQuery = (): string => `SELECT c.relname AS name,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS size
FROM pg_class c
LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
AND n.nspname !~ '^pg_toast'
AND c.relkind='r'
ORDER BY pg_total_relation_size(c.oid) DESC;`.trim()

export default class PgTotalTableSize extends Command {
  static aliases = ['pg:total_table_size']
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'show the size of the tables (including indexes), descending by size'

  static flags = {
    app: flags.app({required: true}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgTotalTableSize)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: ConnectionDetailsWithAttachment = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const output = await utils.pg.psql.exec(db, generateTotalTableSizeQuery())
    ux.log(output)
  }
}
