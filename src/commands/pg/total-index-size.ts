'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export const generateTotalIndexSizeQuery = (): string => `
SELECT pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size
FROM pg_class c
LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
AND n.nspname !~ '^pg_toast'
AND c.relkind='i';
`.trim()

export default class PgTotalIndexSize extends Command {
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'show the total size of all indexes in MB'

  static flags = {
    app: flags.app({required: true}),
  }

  static hiddenAliases = ['pg:total_index_size']


  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgTotalIndexSize)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const output = await utils.pg.psql.exec(db, generateTotalIndexSizeQuery())
    ux.log(output)
  }
}
