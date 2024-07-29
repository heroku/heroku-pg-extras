'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('@heroku-cli/plugin-pg-v5')

const query = `\\copy (SELECT r.rolname AS user_name, nsp.nspname AS schema_name, array_to_string(array_agg(distinct p.perm), ';') AS privilege_types FROM pg_namespace AS nsp  CROSS JOIN pg_roles AS r  CROSS JOIN unnest(  ARRAY[  'CREATE',  'USAGE'  ]  ) AS p (perm) WHERE nspname NOT IN ('pg_catalog', 'information_schema') AND nspname NOT LIKE 'pg_temp%' AND nspname NOT LIKE 'pg_toast%' AND has_schema_privilege(rolname, nsp.oid, p.perm) GROUP BY 1, 2 ORDER BY 1 ASC) to '#FILENAME#.csv' CSV HEADER`

function* run(context, heroku) {
  let timestamp = new Date().toISOString()
  let filename = `${timestamp}-schema-privileges`
  let processedQuery = query.replace('#FILENAME#', filename)

  const db = yield pg.fetcher(heroku).database(context.app, context.args.database)
  const output = yield pg.psql.exec(db, processedQuery)
  process.stdout.write(output)
  process.stdout.write(`\nResults available in ${filename}.csv\n`)
}

const cmd = {
  topic: 'pg',
  description: 'output csv of schema privileges',
  needsApp: true,
  needsAuth: true,
  args: [{ name: 'database', optional: true }],
  run: cli.command({ preauth: true }, co.wrap(run)),
}

module.exports = [Object.assign({ command: 'credentials:schema-privileges' }, cmd)]
