

import * as pg from '@heroku-cli/plugin-pg-v5'
import util from '../lib/util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'
import heredoc from 'tsheredoc'

export default class Fdwsql extends Command {
  static topic = 'pg'
  static description = 'generate fdw install sql for database'
  static flags = {
    app: flags.app({required: true}),
  }

  static args = {
    prefix: Args.string({required: true}),
    database: Args.string()
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Fdwsql)
    const {app} = flags
    const {prefix, database} = args

    const query = heredoc(`
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
    `)

    const db = await pg.fetcher(this.heroku).database(app, database)
    const addon = await pg.fetcher(this.heroku).addon(app, database)
    await util.ensureEssentialTierPlan(addon)

    ux.log('CREATE EXTENSION IF NOT EXISTS postgres_fdw;')
    ux.log(`DROP SERVER IF EXISTS ${prefix}_db;`)
    ux.log(`CREATE SERVER ${prefix}_db
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (dbname '${db.database}', host '${db.host}');`)
    ux.log(`CREATE USER MAPPING FOR CURRENT_USER
    SERVER ${prefix}_db
    OPTIONS (user '${db.user}', password '${db.password}');`)

    let output = await pg.psql.exec(db, query)
    output = output.split('\n').filter(l => /CREATE/.test(l)).join('\n')
    process.stdout.write(output)
    ux.log()
  }
}
