'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('@heroku-cli/plugin-pg-v5')
const _ = require('lodash')
const util = require('../lib/util')

function * run (context, heroku) {
  const app = context.app
  const { database } = context.args

  const db = yield pg.fetcher(heroku).addon(app, database)
  yield util.ensureNonStarterPlan(db)
  const host = pg.host(db)

  const credentials = yield heroku.get(`/postgres/v0/databases/${db.name}/credentials`, { host: host })
  const defaultCredentials = _.filter(credentials, c => c.name === 'default')
  const defaultUsers = _.flatMap(defaultCredentials, c => _.map(c.credentials, u => u.user))

  const isDefaultUser = (user) => _.includes(defaultUsers, user)
  const styledName = (user) => {
    if (isDefaultUser(user)) {
      return 'default'
    } else {
      return user
    }
  }

  const rsp = yield heroku.get(`/client/v11/databases/${db.name}/user_connections`, { host })
  const connections = _.map(rsp.connections, function (v, k) {
    return { credential: styledName(k), count: v }
  })

  cli.table(connections, { columns: [{ key: 'credential', label: 'Credential' }, { key: 'count', label: 'Connections' }] })
}

const cmd = {
  topic: 'pg',
  description: 'returns the number of connections per credential',
  needsApp: true,
  needsAuth: true,
  args: [{ name: 'database', optional: true }],
  run: cli.command({ preauth: true }, co.wrap(run))
}

module.exports = [
  Object.assign({ command: 'user-connections' }, cmd),
  Object.assign({ command: 'user_connections', hidden: true }, cmd)
]
