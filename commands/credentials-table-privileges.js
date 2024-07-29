'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('@heroku-cli/plugin-pg-v5')

const query = `\\copy (SELECT r.rolname AS user_name, nsp.nspname AS schema_name, c.relname AS table_name, c.relkind AS relkind, array_to_string(array_agg(distinct p.perm), ';') AS privilege_types FROM pg_class AS c CROSS JOIN pg_roles AS r CROSS JOIN unnest( ARRAY[ 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER' ] ) AS p (perm) INNER JOIN pg_namespace AS nsp ON nsp.oid = c.relnamespace WHERE relkind IN ('r', 'v', 'm', 'f', 'p') AND nspname NOT IN ('pg_catalog', 'information_schema') AND has_table_privilege(rolname, c.oid, p.perm) GROUP BY 1, 2, 3, 4 ORDER BY 1 ASC) TO '#FILENAME#.csv' CSV HEADER`

function* run(context, heroku) {
  let timestamp = new Date().toISOString()
  let filename = `${timestamp}-table-privileges`
  let processedQuery = query.replace('#FILENAME#', filename)

  const db = yield pg.fetcher(heroku).database(context.app, context.args.database)
  const output = yield pg.psql.exec(db, processedQuery)
  process.stdout.write(output)
  process.stdout.write(`\nResults available in ${filename}.csv\n`)
}

const cmd = {
  topic: 'pg',
  description: 'output csv of table privileges',
  needsApp: true,
  needsAuth: true,
  args: [{ name: 'database', optional: true }],
  run: cli.command({ preauth: true }, co.wrap(run)),
}

module.exports = [Object.assign({ command: 'credentials:table-privileges' }, cmd)]
