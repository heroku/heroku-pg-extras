import { getDatabase } from '@heroku/heroku-cli-util/dist/utils/pg/databases.js';
import { exec } from '@heroku/heroku-cli-util/dist/utils/pg/psql.js';
import { Command, flags } from '@heroku-cli/command';
import { Args } from '@oclif/core';
import heredoc from 'tsheredoc';
export default class CacheHit extends Command {
    static args = {
        database: Args.string({ description: 'database to run command against', required: false }),
    };
    static description = 'show index and table hit rate';
    static flags = {
        app: flags.app({ required: true }),
        remote: flags.remote(),
    };
    query = heredoc.default `
SELECT
  'index hit rate' AS name,
  (sum(idx_blks_hit)) / nullif(sum(idx_blks_hit + idx_blks_read),0) AS ratio
FROM pg_statio_user_indexes
UNION ALL
SELECT
 'table hit rate' AS name,
  sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read),0) AS ratio
FROM pg_statio_user_tables;
  `;
    async run() {
        const { args, flags } = await this.parse(CacheHit);
        const { app: appId } = flags;
        const { database: attachmentId } = args;
        const dbConnectionDetails = await getDatabase(this.heroku, appId, attachmentId);
        const output = await exec(dbConnectionDetails, this.query);
        process.stdout.write(output);
    }
}
