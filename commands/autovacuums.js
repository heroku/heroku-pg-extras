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

  let autovacuums = (yield heroku.get(`/client/v11/databases/${db.name}/autovacuums`, {host}))["ongoing"]
    .map((av, index) => {
      av['id'] = index + 1;
      av['query'] = "autovacuum: VACUUM public." + av.query.split(" ").pop()
      return av
    })

  cli.styledHeader("Ongoing Autovacuums")
  cli.table(autovacuums, {
    columns: [
      {key: 'id', label: '#'},
      {key: 'database', label: 'Database'},
      {key: 'username', label: 'User'},
      {key: 'query', label: 'Query'}
    ]
  })

  if ((context.flags.terminate || context.flags.cancel) && autovacuums.length > 0) {
    let force = context.flags.terminate ? '?force' : ''
    let promptText = context.flags.terminate ? 'terminate' : 'cancel'
    let actionText = context.flags.terminate ? 'terminating' : 'canceling'


    console.log("")
    let index = (yield cli.prompt(cli.color.red(`${promptText} #:`), {})) - 1
    let pid = autovacuums[index].pid
    console.log("")

    yield cli.action(`${actionText} autovacuum`, co(function* () {
      yield heroku.delete(`/client/v11/databases/${db.name}/autovacuums/${pid}`, {host})
    }));
  }
}

const cmd = {
  topic: 'pg',
  description: 'returns a list of ongoing autovacuums',
  needsApp: true,
  needsAuth: true,
  args: [{name: 'database', optional: true}],
  run: cli.command({preauth: true}, co.wrap(run)),
  flags: [
    {name: 'terminate', char: 't', description: 'enable termination (forced) prompt'},
    {name: 'cancel', char: 'c', description: 'enable cancel prompt'}
  ]
}

module.exports = [
  Object.assign({command: 'autovacuums'}, cmd)
]
