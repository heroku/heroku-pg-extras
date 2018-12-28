'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('@heroku-cli/plugin-pg-v5')

function * run (context, heroku) {
  let db = yield pg.fetcher(heroku).database(context.app, context.args.database)

  let truncatedQueryString = prefix => {
    let column = `${prefix}query`
    if (context.flags.truncate) {
      return `CASE WHEN length(${column}) <= 40 THEN ${column} ELSE substr(${column}, 0, 39) || '…' END`
    } else {
      return column
    }
  }

  let query = `
  SELECT
    pg_stat_activity.pid,
    pg_class.relname,
    pg_locks.transactionid,
    pg_locks.granted,
    ${truncatedQueryString('pg_stat_activity.')} AS query_snippet,
    age(now(),pg_stat_activity.query_start) AS "age"
  FROM pg_stat_activity,pg_locks left
  OUTER JOIN pg_class
    ON (pg_locks.relation = pg_class.oid)
  WHERE pg_stat_activity.query <> '<insufficient privilege>'
    AND pg_locks.pid = pg_stat_activity.pid
    AND pg_locks.mode = 'ExclusiveLock'
    AND pg_stat_activity.pid <> pg_backend_pid() order by query_start;
  `

  let output = yield pg.psql.exec(db, query)
  process.stdout.write(output)
}

const cmd = {
  topic: 'pg',
  description: 'display queries with active locks',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  flags: [{name: 'truncate', char: 't', description: 'truncates queries to 40 charaters'}],
  run: cli.command({preauth: true}, co.wrap(run))
}

module.exports = [
  Object.assign({command: 'locks'}, cmd)
]
