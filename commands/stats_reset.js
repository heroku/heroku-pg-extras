'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('heroku-pg')

function * run (context, heroku) {
  const app = context.app
  const {database} = context.args

  let db = yield pg.fetcher(heroku).addon(app, database)
  let host = pg.host(db)
  let rsp = yield heroku.put(`/client/v11/databases/${db.name}/stats_reset`, {host})
  cli.log(rsp.message)
}

const cmd = {
  topic: 'pg',
  description: 'calls the Postgres functions pg_stat_reset()',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  run: cli.command(co.wrap(run))
}

module.exports = [
  Object.assign({command: 'stats-reset'}, cmd),
  Object.assign({command: 'stats_reset', hidden: true}, cmd)
]
