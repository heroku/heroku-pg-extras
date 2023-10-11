'use strict'

const co = require('co')
const cli = require('heroku-cli-util')
const pg = require('@heroku-cli/plugin-pg-v5')
const util = require('../lib/util')

function * run (context, heroku) {
  const db = yield pg.fetcher(heroku).database(context.app, context.args.database)

  if (util.essentialNumPlan(db.attachment.addon)) {
    const query = `SELECT *
                   FROM pg_available_extensions
                   WHERE name IN (SELECT unnest(string_to_array(current_setting('rds.extensions'), ', ')))`

    const output = yield pg.psql.exec(db, query)
    process.stdout.write(output)
  } else {
    const query = `SELECT *
                   FROM pg_available_extensions
                   WHERE name IN (SELECT unnest(string_to_array(current_setting('extwlist.extensions'), ',')))`
    const output = yield pg.psql.exec(db, query)
    process.stdout.write(output)
  }
}

const cmd = {
  topic: 'pg',
  description: 'list available and installed extensions',
  needsApp: true,
  needsAuth: true,
  args: [{ name: 'database', optional: true }],
  run: cli.command({ preauth: true }, co.wrap(run))
}

module.exports = [
  Object.assign({ command: 'extensions' }, cmd)
]
