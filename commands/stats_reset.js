'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('@heroku-cli/plugin-pg-v5')
const util = require('../lib/util')

function * run (context, heroku) {
  const app = context.app
  const { database } = context.args

  const db = yield pg.fetcher(heroku).addon(app, database)
  yield util.ensureNonStarterPlan(db)
  const host = pg.host(db)
  const rsp = yield heroku.put(`/client/v11/databases/${db.name}/stats_reset`, { host })
  cli.log(rsp.message)
}

const cmd = {
  topic: 'pg',
  description: 'calls the Postgres functions pg_stat_reset()',
  needsApp: true,
  needsAuth: true,
  args: [{ name: 'database', optional: true }],
  run: cli.command({ preauth: true }, co.wrap(run))
}

module.exports = [
  Object.assign({ command: 'stats-reset' }, cmd),
  Object.assign({ command: 'stats_reset', hidden: true }, cmd)
]
