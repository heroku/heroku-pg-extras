'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('@heroku-cli/plugin-pg-v5')

const query = `
SELECT relname,
   CASE idx_scan
     WHEN 0 THEN 'Insufficient data'
     ELSE (100 * idx_scan / (seq_scan + idx_scan))::text
   END percent_of_times_index_used,
   n_live_tup rows_in_table
 FROM
   pg_stat_user_tables
 ORDER BY
   n_live_tup DESC;
`

function * run (context, heroku) {
  let db = yield pg.fetcher(heroku).database(context.app, context.args.database)
  let output = yield pg.psql.exec(db, query)
  process.stdout.write(output)
}

const cmd = {
  topic: 'pg',
  description: 'calculates your index hit rate (effective databases are at 99% and up)',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}

module.exports = [
  Object.assign({command: 'index-usage'}, cmd),
  Object.assign({command: 'index_usage', hidden: true}, cmd)
]
