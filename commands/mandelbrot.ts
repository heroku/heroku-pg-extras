// @ts-ignore
import {utils} from '@heroku/heroku-cli-util'
import {Command, flags} from '@heroku-cli/command'
import {Args} from '@oclif/core'
import heredoc from 'tsheredoc'

export default class Mandelbrot extends Command {
  static topic = 'pg'
  static description = 'show the mandelbrot set'
  static args = {
    database: Args.string({description: 'database to run command against', required: false}),
  }

  static flags = {
    app: flags.app({required: true}),
  }

  private readonly query = heredoc(`
      WITH RECURSIVE Z(IX, IY, CX, CY, X, Y, I) AS (
                SELECT IX, IY, X::float, Y::float, X::float, Y::float, 0
                FROM (select -2.2 + 0.031 * i, i from generate_series(0,101) as i) as xgen(x,ix),
                    (select -1.5 + 0.031 * i, i from generate_series(0,101) as i) as ygen(y,iy)
                UNION ALL
                SELECT IX, IY, CX, CY, X * X - Y * Y + CX AS X, Y * X * 2 + CY, I + 1
                FROM Z
                WHERE X * X + Y * Y < 16::float
                AND I < 100
          )
    SELECT array_to_string(array_agg(SUBSTRING(' .,,,-----++++%%%%@@@@#### ', LEAST(GREATEST(I,1),27), 1)),'')
    FROM (
          SELECT IX, IY, MAX(I) AS I
          FROM Z
          GROUP BY IY, IX
          ORDER BY IY, IX
        ) AS ZT
    GROUP BY IY
    ORDER BY IY
  `)

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Mandelbrot)
    const {app: appId} = flags
    const {database: attachmentId} = args

    const dbConnectionDetails = await utils.pg.fetcher.database(this.heroku, appId, attachmentId)
    const output = await utils.pg.psql.exec(dbConnectionDetails, this.query)
    process.stdout.write(output)
  }
}
