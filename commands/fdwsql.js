'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('@heroku-cli/plugin-pg-v5')
const util = require('../lib/util')

const query = prefix => `
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
`

function * run (context, heroku) {
  const app = context.app
  const {prefix, database} = context.args

  let db = yield pg.fetcher(heroku).database(app, database)
  let addon = yield pg.fetcher(heroku).addon(app, database)
  yield util.ensureNonStarterPlan(addon)
  cli.log('CREATE EXTENSION IF NOT EXISTS postgres_fdw;')
  cli.log(`DROP SERVER IF EXISTS ${prefix}_db;`)
  cli.log(`CREATE SERVER ${prefix}_db
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (dbname '${db.database}', host '${db.host}');`)
  cli.log(`CREATE USER MAPPING FOR CURRENT_USER
  SERVER ${prefix}_db
  OPTIONS (user '${db.user}', password '${db.password}');`)
  let output = yield pg.psql.exec(db, query(prefix))
  output = output.split('\n').filter(l => /CREATE/.test(l)).join('\n')
  process.stdout.write(output)
  cli.log()
}

const cmd = {
  topic: 'pg',
  description: 'generate fdw install sql for database',
  needsApp: true,
  needsAuth: true,
  args: [
    {name: 'prefix'},
    {name: 'database', optional: true}
  ],
  run: cli.command({preauth: true}, co.wrap(run))
}

module.exports = [
  Object.assign({command: 'fdwsql'}, cmd)
]
