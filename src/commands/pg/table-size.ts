'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export default class PgTableSize extends Command {
  static args = {
    database: Args.string({description: 'database name'}),
  }

  static description = 'show the size of the tables (excluding indexes), descending by size'

  static flags = {
    app: flags.app({required: true}),
    remote: flags.remote({char: 'r'}),
  }

  private readonly query = `
SELECT c.relname AS name,
  pg_size_pretty(pg_table_size(c.oid)) AS size
FROM pg_class c
LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
AND n.nspname !~ '^pg_toast'
AND c.relkind='r'
ORDER BY pg_table_size(c.oid) DESC;
`

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgTableSize)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const output = await utils.pg.psql.exec(db, this.query)
    ux.log(output)
  }
}
