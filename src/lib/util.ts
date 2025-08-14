'use strict'

import {utils} from '@heroku/heroku-cli-util'

// Using the same type pattern as in bloat.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any

interface Plan {
  plan: {
    name: string
  }
}

async function ensurePGStatStatement(db: Database): Promise<void> {
  const query = `
SELECT exists(
  SELECT 1 FROM pg_extension e LEFT JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname='pg_stat_statements' AND n.nspname = 'public'
) AS available`
  const output = await utils.pg.psql.exec(db, query)

  if (!output.includes('t')) {
    throw new Error(`pg_stat_statements extension need to be installed in the public schema first.
You can install it by running:

    CREATE EXTENSION pg_stat_statements;`)
  }
}

async function ensureEssentialTierPlan(db: Database): Promise<void> {
  if (db.plan.name.match(/(dev|basic|essential-[0-9]+)$/)) {
    throw new Error('This operation is not supported by Essential-tier databases.')
  }
}

function essentialNumPlan(a: Plan): boolean {
  return !!a.plan.name.split(':')[1].match(/^essential/)
}

async function newTotalExecTimeField(db: Database): Promise<boolean> {
  const newTotalExecTimeFieldQuery = 'SELECT current_setting(\'server_version_num\')::numeric >= 130000'
  const newTotalExecTimeFieldRaw = await utils.pg.psql.exec(db, newTotalExecTimeFieldQuery, ['-t', '-q'])

  // error checks
  const newTotalExecTimeField = newTotalExecTimeFieldRaw.split('\n')[0].trim()

  if (newTotalExecTimeField !== 't' && newTotalExecTimeField !== 'f') {
    throw new Error(`Unable to determine database version, expected "t" or "f", got: "${newTotalExecTimeField}"`)
  }

  return newTotalExecTimeField === 't'
}

async function newBlkTimeFields(db: Database): Promise<boolean> {
  const newBlkTimeFieldsQuery = 'SELECT current_setting(\'server_version_num\')::numeric >= 170000'
  const newBlkTimeFieldsRaw = await utils.pg.psql.exec(db, newBlkTimeFieldsQuery, ['-t', '-q'])

  // error checks
  const newBlkTimeField = newBlkTimeFieldsRaw.split('\n')[0].trim()

  if (newBlkTimeField !== 't' && newBlkTimeField !== 'f') {
    throw new Error(`Unable to determine database version, expected "t" or "f", got: "${newBlkTimeField}"`)
  }

  return newBlkTimeField === 't'
}

export {
  ensurePGStatStatement,
  ensureEssentialTierPlan,
  essentialNumPlan,
  newTotalExecTimeField,
  newBlkTimeFields
}