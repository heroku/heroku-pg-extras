'use strict'

const co = require('co')
const pg = require('@heroku-cli/plugin-pg-v5')

function * extractPGStatStatementNamespace (db) {
  const query = `
SELECT n.nspname FROM pg_extension e LEFT JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname='pg_stat_statements' AND (n.nspname = 'public' or n.nspname = 'heroku_ext') LIMIT 1`
  const output = yield pg.psql.exec(db, query, ['-t', '-q'])

  const namespace = output.trim()

  if (namespace === '') {
    throw new Error(`pg_stat_statements extension need to be installed in the heroku_ext schema first.
You can install it by running:

    CREATE EXTENSION pg_stat_statements WITH SCHEMA heroku_ext;`)
  } else {
    return namespace
  }
}

function * ensureNonStarterPlan (db) {
  if (db.plan.name.match(/(dev|basic)$/)) {
    throw new Error('This operation is not supported by Hobby tier databases.')
  }
}

function * newTotalExecTimeField (db) {
  const newTotalExecTimeFieldQuery = `SELECT current_setting('server_version_num')::numeric >= 130000`
  const newTotalExecTimeFieldRaw = yield pg.psql.exec(db, newTotalExecTimeFieldQuery, ['-t', '-q'])

  // error checks
  const newTotalExecTimeField = newTotalExecTimeFieldRaw.split("\n")[0].trim()

  if (newTotalExecTimeField !== 't' && newTotalExecTimeField !== 'f') {
    throw new Error(`Unable to determine database version, expected "t" or "f", got: "${newTotalExecTimeField}"`)
  }

  return newTotalExecTimeField === 't'
}

module.exports = {
  extractPGStatStatementNamespace: co.wrap(extractPGStatStatementNamespace),
  ensureNonStarterPlan: co.wrap(ensureNonStarterPlan),
  newTotalExecTimeField: co.wrap(newTotalExecTimeField)
}
