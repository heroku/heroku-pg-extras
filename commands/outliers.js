'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('@heroku-cli/plugin-pg-v5')
const util = require('../lib/util')

function * run (context, heroku) {
  let db = yield pg.fetcher(heroku).database(context.app, context.args.database)

  yield util.ensurePGStatStatement(db)

  if (context.flags.reset) {
    yield pg.psql.exec(db, 'select pg_stat_statements_reset()')
    return
  }

  let truncatedQueryString = context.flags.truncate
    ? 'CASE WHEN length(query) <= 40 THEN query ELSE substr(query, 0, 39) || \'…\' END'
    : 'query'

  let limit = 10
  if (context.flags.num) {
    if (/^(\d+)$/.exec(context.flags.num)) {
      limit = parseInt(context.flags.num)
    } else {
      throw new Error(`Cannot parse num param value "${context.flags.num}" to a number`)
    }
  }

  let newTotalExecTimeField = yield util.newTotalExecTimeField(db)
  let totalExecTimeField = ``
  if (newTotalExecTimeField) {
    totalExecTimeField = "total_exec_time"
  } else {
    totalExecTimeField = "total_time"
  }

  let query = `
SELECT interval '1 millisecond' * ${totalExecTimeField} AS total_exec_time,
to_char((${totalExecTimeField}/sum(${totalExecTimeField}) OVER()) * 100, 'FM90D0') || '%'  AS prop_exec_time,
to_char(calls, 'FM999G999G999G990') AS ncalls,
interval '1 millisecond' * (blk_read_time + blk_write_time) AS sync_io_time,
${truncatedQueryString} AS query
FROM pg_stat_statements WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user LIMIT 1)
ORDER BY ${totalExecTimeField} DESC
LIMIT ${limit}
`

  let output = yield pg.psql.exec(db, query)
  process.stdout.write(output)
}

const cmd = {
  topic: 'pg',
  description: 'show 10 queries that have longest execution time in aggregate',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  flags: [
    {name: 'reset', description: 'resets statistics gathered by pg_stat_statements'},
    {name: 'truncate', char: 't', description: 'truncate queries to 40 characters'},
    {name: 'num', char: 'n', description: 'the number of queries to display (default: 10)', hasValue: true}
  ],
  run: cli.command({preauth: true}, co.wrap(run))
}

module.exports = [
  Object.assign({command: 'outliers'}, cmd)
]
