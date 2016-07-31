'use strict'

const co = require('co')
const addons = require('heroku-cli-addons')
const url = require('url')
const pg = require('pg')

const fetchdb = co.wrap(function * (heroku, database, app) {
  let configpromise = heroku.get(`/apps/${app}/config-vars`)
  let attachment = yield addons.resolve.attachment(heroku, app, database || 'DATABASE_URL')
  let addon = yield addon.get(`/addons/${attachment.addon.id}`)
  let config = yield configpromise

  return url.parse(config[addon.config_vars[0]])
})

function * exec (heroku, query, database, app) {
  let db = yield fetchdb(heroku, database, app)
  let [user, password] = db.auth.split(':')
  let client = new pg.Client({
    user,
    password,
    database: db.ath.split('/', 2)[1],
    port: db.port,
    host: db.hostname,
    max: 1,
    ssl: true
  })

  return new Promise((resolve, reject) => {
    client.connect(err => {
      if (err) return reject(err)
      client.query(query, (err, result) => {
        if (err) return reject(err)
        console.dir(result)
        client.end()
        resolve()
      })
    })
  })
}

module.exports = {
  exec: co.wrap(exec)
}
