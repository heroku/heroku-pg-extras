'use strict'

const co = require('co')
const pg = require('heroku-pg')

function * ensurePGStatStatement (db) {
  let query = `
SELECT exists(
  SELECT 1 FROM pg_extension e LEFT JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname='pg_stat_statements' AND n.nspname = 'public'
) AS available`
  let output = yield pg.psql.exec(db, query)

  if (!output.includes('t')) {
    throw new Error(`pg_stat_statements extension need to be installed in the public schema first.
You can install it by running:

    CREATE EXTENSION pg_stat_statements;`)
  }
}

function * ensureNonStarterPlan (db) {
  if (db.plan.name.match(/(dev|basic)$/)) {
    throw new Error(`This operation is not supported by Hobby tier databases.`)
  }
}

module.exports = {
  ensurePGStatStatement: co.wrap(ensurePGStatStatement),
  ensureNonStarterPlan: co.wrap(ensureNonStarterPlan)
}
