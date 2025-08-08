import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args} from '@oclif/core'
import heredoc from 'tsheredoc'

import {essentialNumPlan} from '../../lib/util.js'

export default class Extensions extends Command {
  static args = {
    database: Args.string({description: 'database to run command against', required: false}),
  }

  static description = 'list available and installed extensions'

  static flags = {
    app: flags.app({required: true}),
    remote: flags.remote(),
  }

  private readonly essentialPlanQuery = heredoc.default`
    SELECT *
    FROM pg_available_extensions
    WHERE name IN (SELECT unnest(string_to_array(current_setting('rds.allowed_extensions'), ',')))
  `

  private readonly standardPlanQuery = heredoc.default`
    SELECT *
    FROM pg_available_extensions
    WHERE name IN (SELECT unnest(string_to_array(current_setting('extwlist.extensions'), ',')))
  `

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Extensions)
    const {app: appId} = flags
    const {database: attachmentId} = args

    const dbConnectionDetails = await utils.pg.fetcher.database(this.heroku, appId, attachmentId)

    // Check if it's an essential plan to determine which query to use
    const isEssentialPlan = essentialNumPlan(dbConnectionDetails.attachment.addon)

    const query = isEssentialPlan ? this.essentialPlanQuery : this.standardPlanQuery

    const output = await utils.pg.psql.exec(dbConnectionDetails, query)
    process.stdout.write(output)
  }
}
