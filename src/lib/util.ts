const {utils: utilsUtil} = require('@heroku/heroku-cli-util')
const heredocUtil = require('tsheredoc')

async function ensurePGStatStatement(connectionDetails: any) {
  const query = heredocUtil.default`
    SELECT exists(
      SELECT 1 FROM pg_extension e LEFT JOIN pg_namespace n ON n.oid = e.extnamespace
      WHERE e.extname='pg_stat_statements' AND n.nspname = 'public'
    ) AS available
  `
  const output = await utilsUtil.pg.psql.exec(connectionDetails, query)

  if (!output.includes('t')) {
    throw new Error(heredocUtil.default`
      pg_stat_statements extension need to be installed in the public schema first.
      You can install it by running:

      CREATE EXTENSION pg_stat_statements;
    `)
  }
}

function ensureEssentialTierPlan(db: any) {
  if (db.plan?.name.match(/(dev|basic|essential-\d+)$/)) {
    throw new Error('This operation is not supported by Essential-tier databases.')
  }
}

function essentialNumPlan(db: any) {
  return Boolean(db.plan?.name?.split(':')[1].match(/^essential/))
}

// NOTE: Maybe we can remove this function now. We don't believe any Heroku PostgreSQL database add-on is under version 13 anymore.
async function newTotalExecTimeField(connectionDetails: any) {
  const newTotalExecTimeFieldQuery = 'SELECT current_setting(\'server_version_num\')::numeric >= 130000'
  const newTotalExecTimeFieldRaw = await utilsUtil.pg.psql.exec(connectionDetails, newTotalExecTimeFieldQuery, ['-t', '-q'])

  // error checks
  const newTotalExecTimeField = newTotalExecTimeFieldRaw.split('\n')[0].trim()

  if (newTotalExecTimeField !== 't' && newTotalExecTimeField !== 'f') {
    throw new Error(`Unable to determine database version, expected "t" or "f", got: "${newTotalExecTimeField}"`)
  }

  return newTotalExecTimeField === 't'
}

async function newBlkTimeFields(connectionDetails: any) {
  const newBlkTimeFieldsQuery = 'SELECT current_setting(\'server_version_num\')::numeric >= 170000'
  const newBlkTimeFieldsRaw = await utilsUtil.pg.psql.exec(connectionDetails, newBlkTimeFieldsQuery, ['-t', '-q'])

  // error checks
  const newBlkTimeField = newBlkTimeFieldsRaw.split('\n')[0].trim()

  if (newBlkTimeField !== 't' && newBlkTimeField !== 'f') {
    throw new Error(`Unable to determine database version, expected "t" or "f", got: "${newBlkTimeField}"`)
  }

  return newBlkTimeField === 't'
}

module.exports = {
  ensurePGStatStatement,
  ensureEssentialTierPlan,
  essentialNumPlan,
  newTotalExecTimeField,
  newBlkTimeFields
}
