'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('@heroku-cli/plugin-pg-v5')

function * run (context, heroku) {
  let db = yield pg.fetcher(heroku).database(context.app, context.args.database)

  let query = `
SELECT
  schemaname || '.' || relname AS table,
  indexrelname AS index,
  pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
  idx_scan as index_scans
FROM pg_stat_user_indexes ui
JOIN pg_index i ON ui.indexrelid = i.indexrelid
WHERE NOT indisunique AND idx_scan < 50 AND pg_relation_size(relid) > 5 * 8192
ORDER BY pg_relation_size(i.indexrelid) / nullif(idx_scan, 0) DESC NULLS FIRST,
pg_relation_size(i.indexrelid) DESC;
`

  let output = yield pg.psql.exec(db, query)
  process.stdout.write(output)
}

const cmd = {
  topic: 'pg',
  description: 'show unused and almost unused indexes',
  help: `
Ordered by their size relative to the number of index scans.
Exclude indexes of very small tables (less than 5 pages),
where the planner will almost invariably select a sequential scan,
but may not in the future as the table grows`,
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}

module.exports = [
  Object.assign({command: 'unused-indexes'}, cmd),
  Object.assign({command: 'unused_indexes', hidden: true}, cmd)
]
