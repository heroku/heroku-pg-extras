'use strict'

import type {ConnectionDetailsWithAttachment} from '@heroku/heroku-cli-util'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export function generateVacuumStatsQuery(): string {
  return `WITH table_opts AS (
  SELECT
    pg_class.oid, relname, nspname, array_to_string(reloptions, '') AS relopts
  FROM
     pg_class INNER JOIN pg_namespace ns ON relnamespace = ns.oid
), vacuum_settings AS (
  SELECT
    oid, relname, nspname,
    CASE
      WHEN relopts LIKE '%autovacuum_vacuum_threshold%'
        THEN substring(relopts, '.*autovacuum_vacuum_threshold=([0-9.]+).*')::integer
        ELSE current_setting('autovacuum_vacuum_threshold')::integer
      END AS autovacuum_vacuum_threshold,
    CASE
      WHEN relopts LIKE '%autovacuum_vacuum_scale_factor%'
        THEN substring(relopts, '.*autovacuum_vacuum_scale_factor=([0-9.]+).*')::real
        ELSE current_setting('autovacuum_vacuum_scale_factor')::real
      END AS autovacuum_vacuum_scale_factor
  FROM
    table_opts
)
SELECT
  vacuum_settings.nspname AS schema,
  vacuum_settings.relname AS table,
  to_char(psut.last_vacuum, 'YYYY-MM-DD HH24:MI') AS last_vacuum,
  to_char(psut.last_autovacuum, 'YYYY-MM-DD HH24:MI') AS last_autovacuum,
  to_char(pg_class.reltuples, '9G999G999G999') AS rowcount,
  to_char(psut.n_dead_tup, '9G999G999G999') AS dead_rowcount,
  to_char(autovacuum_vacuum_threshold
       + (autovacuum_vacuum_scale_factor::numeric * pg_class.reltuples), '9G999G999G999') AS autovacuum_threshold,
  CASE
    WHEN autovacuum_vacuum_threshold + (autovacuum_vacuum_scale_factor::numeric * pg_class.reltuples) < psut.n_dead_tup
    THEN 'yes'
  END AS expect_autovacuum
FROM
  pg_stat_user_tables psut INNER JOIN pg_class ON psut.relid = pg_class.oid
    INNER JOIN vacuum_settings ON pg_class.oid = vacuum_settings.oid
ORDER BY 1`
}

export default class PgVacuumStats extends Command {
  static aliases = ['pg:vacuum_stats']
  static args = {
    database: Args.string({description: 'database name', required: false}),
  }

  static description = 'show dead rows and whether an automatic vacuum is expected to be triggered'

  static flags = {
    app: flags.app({required: true}),
  }

  static needsAuth = true
  static preauth = true

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgVacuumStats)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: ConnectionDetailsWithAttachment = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const output = await utils.pg.psql.exec(db, generateVacuumStatsQuery())
    ux.log(output)
  }
}
