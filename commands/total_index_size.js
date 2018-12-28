'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('@heroku-cli/plugin-pg-v5')

const query = `
SELECT pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size
FROM pg_class c
LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
AND n.nspname !~ '^pg_toast'
AND c.relkind='i';
`

function * run (context, heroku) {
  let db = yield pg.fetcher(heroku).database(context.app, context.args.database)
  let output = yield pg.psql.exec(db, query)
  process.stdout.write(output)
}

const cmd = {
  topic: 'pg',
  description: 'show the total size of all indexes in MB',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}

module.exports = [
  Object.assign({command: 'total-index-size'}, cmd),
  Object.assign({command: 'total_index_size', hidden: true}, cmd)
]
