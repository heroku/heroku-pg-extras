'use strict'

import type {ConnectionDetailsWithAttachment} from '@heroku/heroku-cli-util'

import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args, ux} from '@oclif/core'

export function generateUnusedIndexesQuery(): string {
  return `SELECT
  schemaname || '.' || relname AS table,
  indexrelname AS index,
  pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
  idx_scan as index_scans
FROM pg_stat_user_indexes ui
JOIN pg_index i ON ui.indexrelid = i.indexrelid
WHERE NOT indisunique AND idx_scan < 50 AND pg_relation_size(relid) > 5 * 8192
ORDER BY pg_relation_size(i.indexrelid) / nullif(idx_scan, 0) DESC NULLS FIRST,
pg_relation_size(i.indexrelid) DESC;`
}

export default class PgUnusedIndexes extends Command {
  static args = {
    database: Args.string({description: 'database name'}),
  }

  static description = 'show unused and almost unused indexes'

  static flags = {
    app: flags.app({required: true}),
    remote: flags.remote({char: 'r'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(PgUnusedIndexes)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: ConnectionDetailsWithAttachment = await utils.pg.fetcher.database(this.heroku as any, flags.app, args.database)

    const output = await utils.pg.psql.exec(db, generateUnusedIndexesQuery())
    ux.log(output)
  }
}
