'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('heroku-pg')
const _ = require('lodash')

function * run (context, heroku) {
  const app = context.app
  const {database} = context.args

  let db = yield pg.fetcher(heroku).addon(app, database)
  let host = pg.host(db)
  let rsp = yield heroku.get(`/client/v11/databases/${db.name}/user_connections`, {host})
  let connections = _.map(rsp.connections, function (v, k) {
    return {credential: k, count: v}
  })
  cli.table(connections, {columns: [ {key: 'credential', label: 'Credential'}, {key: 'count', label: 'Connections'} ]})
}

const cmd = {
  topic: 'pg',
  description: 'returns the number of connections per credential',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run))
}

module.exports = [
  Object.assign({command: 'user-connections'}, cmd),
  Object.assign({command: 'user_connections', hidden: true}, cmd)
]
