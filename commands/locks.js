'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('heroku-pg')

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
    pg_locks.virtualtransaction AS vxid,
    pg_namespace.nspname AS schema,
    pg_class.relname,
    pg_class.relkind,
    CASE
      WHEN virtualxid IS NOT NULL AND transactionid IS NOT NULL
      THEN virtualxid || ' ' || transactionid
      WHEN virtualxid IS NOT NULL
      THEN virtualxid::text
      ELSE transactionid::text
    END AS xid_lock,
    pg_locks.granted,
    pg_locks.locktype AS lock_type,
    pg_locks.mode AS lock_mode,
    ${truncatedQueryString('pg_stat_activity.')} AS query_snippet,
    age(now(),pg_stat_activity.query_start) AS "age"
  FROM pg_stat_activity, pg_locks
  LEFT OUTER JOIN pg_class
    ON (pg_locks.relation = pg_class.oid)
  LEFT OUTER JOIN pg_namespace
    ON (pg_class.relnamespace = pg_namespace.oid)
  WHERE pg_stat_activity.query <> '<insufficient privilege>'
    AND pg_locks.pid = pg_stat_activity.pid
    AND pg_locks.mode IN ('ExclusiveLock', 'AccessExclusiveLock', 'RowExclusiveLock')
    AND pg_stat_activity.pid <> pg_backend_pid()
    AND virtualtransaction IS DISTINCT FROM virtualxid
    ORDER BY pg_stat_activity.query_start
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
