'use strict'

import type {ConnectionDetailsWithAttachment} from '@heroku/heroku-cli-util'

import {utils} from '@heroku/heroku-cli-util'
import * as Heroku from '@heroku-cli/schema'

// Using the proper type instead of any
type Database = ConnectionDetailsWithAttachment

interface Plan {
  plan: Heroku.AddOn['plan']
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
  if (db.attachment.addon.plan.name.match(/(dev|basic|essential-\d+)$/)) {
    throw new Error('This operation is not supported by Essential-tier databases.')
  }
}

function essentialNumPlan(a: Plan): boolean {
  if (!a.plan?.name) return false
  const parts = a.plan.name.split(':')
  if (parts.length < 2) return false
  return Boolean(parts[1].match(/^essential/))
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
  ensureEssentialTierPlan,
  ensurePGStatStatement,
  essentialNumPlan,
  newBlkTimeFields,
  newTotalExecTimeField,
}
