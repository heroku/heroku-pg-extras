'use strict'

const co = require('co')
const pg = require('@heroku-cli/plugin-pg-v5')

function * ensurePGStatStatement (db) {
  const query = `
SELECT exists(
  SELECT 1 FROM pg_extension e LEFT JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname='pg_stat_statements' AND n.nspname = 'public'
) AS available`
  const output = yield pg.psql.exec(db, query)

  if (!output.includes('t')) {
    throw new Error(`pg_stat_statements extension need to be installed in the public schema first.
You can install it by running:

    CREATE EXTENSION pg_stat_statements;`)
  }
}

function * ensureEssentialTierPlan (db) {
  if (db.plan.name.match(/(dev|basic|essential-[0-9]+)$/)) {
    throw new Error('This operation is not supported by Essential-tier databases.')
  }
}

function essentialNumPlan (a) {
  return !!a.plan.name.split(':')[1].match(/^essential/)
}

function * newTotalExecTimeField (db) {
  const newTotalExecTimeFieldQuery = `SELECT current_setting('server_version_num')::numeric >= 130000`
  const newTotalExecTimeFieldRaw = yield pg.psql.exec(db, newTotalExecTimeFieldQuery, ['-t', '-q'])

  // error checks
  const newTotalExecTimeField = newTotalExecTimeFieldRaw.split('\n')[0].trim()

  if (newTotalExecTimeField !== 't' && newTotalExecTimeField !== 'f') {
    throw new Error(`Unable to determine database version, expected "t" or "f", got: "${newTotalExecTimeField}"`)
  }

  return newTotalExecTimeField === 't'
}

function * newBlkTimeFields (db) {
  const newBlkTimeFieldsQuery = `SELECT current_setting('server_version_num')::numeric >= 170000`
  const newBlkTimeFieldsRaw = yield pg.psql.exec(db, newBlkTimeFieldsQuery, ['-t', '-q'])

  // error checks
  const newBlkTimeField = newBlkTimeFieldsRaw.split('\n')[0].trim()

  if (newBlkTimeField !== 't' && newBlkTimeField !== 'f') {
    throw new Error(`Unable to determine database version, expected "t" or "f", got: "${newBlkReadField}"`)
  }

  return newBlkTimeField === 't'
}

module.exports = {
  ensurePGStatStatement: co.wrap(ensurePGStatStatement),
  ensureEssentialTierPlan: co.wrap(ensureEssentialTierPlan),
  essentialNumPlan: essentialNumPlan,
  newTotalExecTimeField: co.wrap(newTotalExecTimeField),
  newBlkTimeFields: co.wrap(newBlkTimeFields)
}
