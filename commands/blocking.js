'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('@heroku-cli/plugin-pg-v5')

const query = `
SELECT bl.pid AS blocked_pid,
  ka.query AS blocking_statement,
  now() - ka.query_start AS blocking_duration,
  kl.pid AS blocking_pid,
  a.query AS blocked_statement,
  now() - a.query_start AS blocked_duration
FROM pg_catalog.pg_locks bl
JOIN pg_catalog.pg_stat_activity a
  ON bl.pid = a.pid
JOIN pg_catalog.pg_locks kl
  JOIN pg_catalog.pg_stat_activity ka
    ON kl.pid = ka.pid
ON bl.transactionid = kl.transactionid AND bl.pid != kl.pid
WHERE NOT bl.granted
`

function * run (context, heroku) {
  let db = yield pg.fetcher(heroku).database(context.app, context.args.database)
  let output = yield pg.psql.exec(db, query)
  process.stdout.write(output)
}

const cmd = {
  topic: 'pg',
  description: 'display queries holding locks other queries are waiting to be released',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}

module.exports = [
  Object.assign({command: 'blocking'}, cmd)
]
