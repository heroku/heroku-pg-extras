'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const {psql} = require('heroku-pg')

const query = `
SELECT pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size
FROM pg_class c
LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
AND n.nspname !~ '^pg_toast'
AND c.relkind='i';
`

function * run (context, heroku) {
  const app = context.app
  const {database} = context.args

  let output = yield psql.exec(heroku, query, database, app)
  process.stdout.write(output)
}

const cmd = {
  topic: 'pg',
  description: 'show the total size of all indexes in MB',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  run: cli.command(co.wrap(run))
}

module.exports = [
  Object.assign({command: 'total_index_size', hidden: true}, cmd),
  Object.assign({command: 'total-index-size'}, cmd)
]
