'use strict'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

import * as util from '../../lib/util'

export const generateFdwsqlQuery = (prefix: string): string => `
SELECT
  'CREATE FOREIGN TABLE '
  || quote_ident('${prefix}_' || c.relname)
  || '(' || array_to_string(array_agg(quote_ident(a.attname) || ' ' || t.typname), ', ') || ') '
  || ' SERVER ${prefix}_db OPTIONS'
  || ' (schema_name ''' || quote_ident(n.nspname) || ''', table_name ''' || quote_ident(c.relname) || ''');'
FROM
  pg_class     c,
  pg_attribute a,
  pg_type      t,
  pg_namespace n
WHERE
  a.attnum > 0
  AND a.attrelid = c.oid
  AND a.atttypid = t.oid
  AND n.oid = c.relnamespace
  AND c.relkind in ('r', 'v')
  AND n.nspname <> 'pg_catalog'
  AND n.nspname <> 'information_schema'
  AND n.nspname !~ '^pg_toast'
  AND pg_catalog.pg_table_is_visible(c.oid)
GROUP BY c.relname, n.nspname
ORDER BY c.relname;
`.trim()

export default class PgFdwsql extends Command {
  /* eslint-disable perfectionist/sort-objects */
  static args = {
    prefix: Args.string({description: 'prefix for foreign data wrapper', required: true}),
    database: Args.string({description: 'database name'}),
  }
  /* eslint-enable perfectionist/sort-objects */

  static description = 'generate fdw install sql for database'

  static flags = {
    app: flags.app({required: true}),
    remote: flags.remote({char: 'r'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgFdwsql)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbConnection = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    await util.ensureEssentialTierPlan(dbConnection)

    ux.log('CREATE EXTENSION IF NOT EXISTS postgres_fdw;')
    ux.log(`DROP SERVER IF EXISTS ${args.prefix}_db;`)
    ux.log(`CREATE SERVER ${args.prefix}_db
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (dbname '${dbConnection.database}', host '${dbConnection.host}');`)
    ux.log(`CREATE USER MAPPING FOR CURRENT_USER
  SERVER ${args.prefix}_db
  OPTIONS (user '${dbConnection.user}', password '${dbConnection.password}');`)

    let output = await utils.pg.psql.exec(dbConnection, generateFdwsqlQuery(args.prefix))
    output = output.split('\n').filter((l: string) => /CREATE/.test(l)).join('\n')
    ux.log(output)
  }
}
