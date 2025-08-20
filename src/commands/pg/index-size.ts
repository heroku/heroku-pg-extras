'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export const generateIndexSizeQuery = (): string => `
SELECT c.relname AS name,
  pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size
FROM pg_class c
LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
AND n.nspname !~ '^pg_toast'
AND c.relkind='i'
GROUP BY c.relname
ORDER BY sum(c.relpages) DESC;
`.trim()

export default class PgIndexSize extends Command {
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'show the size of indexes, descending by size'

  static flags = {
    app: flags.app({required: true}),
  }

  static hiddenAliases = ['pg:index_size']

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgIndexSize)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbConnection = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const output = await utils.pg.psql.exec(dbConnection, generateIndexSizeQuery())
    ux.log(output)
  }
}
