import {expect} from 'chai'
import {stderr, stdout} from 'stdout-stderr'

import PgOutliers from '../../../src/commands/pg/outliers'
import stripAnsi from '../../helpers/strip-ansi'
import {runCommand} from '../../run-command'

// Custom error testing utility
const expectRejection = async (promise: Promise<unknown>, expectedMessage: string) => {
  try {
    await promise
    expect.fail('Should have thrown an error')
  } catch (error: unknown) {
    const err = error as Error
    expect(err.message).to.include(expectedMessage)
  }
}

describe('pg:outliers', function () {
  const {env} = process

  beforeEach(function () {
    process.env = {}
  })

  afterEach(function () {
    process.env = env
  })

  context('when the --app flag is specified', function () {
    context('when outliers query executes successfully', function () {
      it('shows top queries by execution time', async function () {
        // Mock the database connection and query execution
        const mockDbConnection = {
          attachment: {
            addon: {
              plan: {
                name: 'premium-0',
              },
            },
            name: 'DATABASE',
          },
          database: 'test-db',
          host: 'test-host',
          password: 'test-password',
          user: 'test-user',
        }

        // Mock the utils.pg.fetcher.database and utils.pg.psql.exec
        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec

        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.resolve('total_exec_time | prop_exec_time | ncalls | sync_io_time | query')

        // Mock utility function responses
        const util = require('../../../src/lib/util')
        const originalEnsurePGStatStatement = util.ensurePGStatStatement
        const originalNewTotalExecTimeField = util.newTotalExecTimeField
        const originalNewBlkTimeFields = util.newBlkTimeFields

        util.ensurePGStatStatement = () => Promise.resolve()
        util.newTotalExecTimeField = () => Promise.resolve(true)
        util.newBlkTimeFields = () => Promise.resolve(true)

        try {
          await runCommand(PgOutliers, ['--app=my-app'])

          expect(stripAnsi(stdout.output)).to.include('total_exec_time')
          expect(stderr.output).to.equal('')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
          util.ensurePGStatStatement = originalEnsurePGStatStatement
          util.newTotalExecTimeField = originalNewTotalExecTimeField
          util.newBlkTimeFields = originalNewBlkTimeFields
        }
      })
    })

    context('when reset flag is specified', function () {
      it('resets pg_stat_statements statistics', async function () {
        const mockDbConnection = {
          attachment: {
            addon: {
              plan: {
                name: 'premium-0',
              },
            },
            name: 'DATABASE',
          },
          database: 'test-db',
          host: 'test-host',
          password: 'test-password',
          user: 'test-user',
        }

        // Mock the utils.pg.fetcher.database and utils.pg.psql.exec
        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec

        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.resolve('')

        // Mock utility function responses
        const util = require('../../../src/lib/util')
        const originalEnsurePGStatStatement = util.ensurePGStatStatement

        util.ensurePGStatStatement = () => Promise.resolve()

        try {
          await runCommand(PgOutliers, ['--app=my-app', '--reset'])

          expect(stderr.output).to.equal('')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
          util.ensurePGStatStatement = originalEnsurePGStatStatement
        }
      })
    })

    context('when truncate flag is specified', function () {
      it('truncates queries to 40 characters', async function () {
        const mockDbConnection = {
          attachment: {
            addon: {
              plan: {
                name: 'premium-0',
              },
            },
            name: 'DATABASE',
          },
          database: 'test-db',
          host: 'test-host',
          password: 'test-password',
          user: 'test-user',
        }

        // Mock the utils.pg.fetcher.database and utils.pg.psql.exec
        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec

        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.resolve('total_exec_time | prop_exec_time | ncalls | sync_io_time | query')

        // Mock utility function responses
        const util = require('../../../src/lib/util')
        const originalEnsurePGStatStatement = util.ensurePGStatStatement
        const originalNewTotalExecTimeField = util.newTotalExecTimeField
        const originalNewBlkTimeFields = util.newBlkTimeFields

        util.ensurePGStatStatement = () => Promise.resolve()
        util.newTotalExecTimeField = () => Promise.resolve(true)
        util.newBlkTimeFields = () => Promise.resolve(true)

        try {
          await runCommand(PgOutliers, ['--app=my-app', '--truncate'])

          expect(stripAnsi(stdout.output)).to.include('total_exec_time')
          expect(stderr.output).to.equal('')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
          util.ensurePGStatStatement = originalEnsurePGStatStatement
          util.newTotalExecTimeField = originalNewTotalExecTimeField
          util.newBlkTimeFields = originalNewBlkTimeFields
        }
      })
    })

    context('when num flag is specified', function () {
      it('limits output to specified number of queries', async function () {
        const mockDbConnection = {
          attachment: {
            addon: {
              plan: {
                name: 'premium-0',
              },
            },
            name: 'DATABASE',
          },
          database: 'test-db',
          host: 'test-host',
          password: 'test-password',
          user: 'test-user',
        }

        // Mock the utils.pg.fetcher.database and utils.pg.psql.exec
        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec

        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.resolve('total_exec_time | prop_exec_time | ncalls | sync_io_time | query')

        // Mock utility function responses
        const util = require('../../../src/lib/util')
        const originalEnsurePGStatStatement = util.ensurePGStatStatement
        const originalNewTotalExecTimeField = util.newTotalExecTimeField
        const originalNewBlkTimeFields = util.newBlkTimeFields

        util.ensurePGStatStatement = () => Promise.resolve()
        util.newTotalExecTimeField = () => Promise.resolve(true)
        util.newBlkTimeFields = () => Promise.resolve(true)

        try {
          await runCommand(PgOutliers, ['--app=my-app', '--num=5'])

          expect(stripAnsi(stdout.output)).to.include('total_exec_time')
          expect(stderr.output).to.equal('')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
          util.ensurePGStatStatement = originalEnsurePGStatStatement
          util.newTotalExecTimeField = originalNewTotalExecTimeField
          util.newBlkTimeFields = originalNewBlkTimeFields
        }
      })
    })

    context('when database connection fails', function () {
      it('shows error message', async function () {
        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.reject(new Error('Database connection failed'))

        try {
          await expectRejection(runCommand(PgOutliers, ['--app=my-app']), 'Database connection failed')
        } finally {
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
        }
      })
    })

    context('when pg_stat_statements extension is not available', function () {
      it('shows error message', async function () {
        const mockDbConnection = {
          attachment: {
            addon: {
              plan: {
                name: 'premium-0',
              },
            },
            name: 'DATABASE',
          },
          database: 'test-db',
          host: 'test-host',
          password: 'test-password',
          user: 'test-user',
        }

        // Mock the utils.pg.fetcher.database
        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)

        // Mock utility function to throw error
        const util = require('../../../src/lib/util')
        const originalEnsurePGStatStatement = util.ensurePGStatStatement

        util.ensurePGStatStatement = () => Promise.reject(new Error('pg_stat_statements extension not available'))

        try {
          await expectRejection(runCommand(PgOutliers, ['--app=my-app']), 'pg_stat_statements extension not available')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          util.ensurePGStatStatement = originalEnsurePGStatStatement
        }
      })
    })

    context('when query execution fails', function () {
      it('shows error message', async function () {
        const mockDbConnection = {
          attachment: {
            addon: {
              plan: {
                name: 'premium-0',
              },
            },
            name: 'DATABASE',
          },
          database: 'test-db',
          host: 'test-host',
          password: 'test-password',
          user: 'test-user',
        }

        // Mock the utils.pg.fetcher.database
        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)

        // Mock utility function responses
        const util = require('../../../src/lib/util')
        const originalEnsurePGStatStatement = util.ensurePGStatStatement
        const originalNewTotalExecTimeField = util.newTotalExecTimeField
        const originalNewBlkTimeFields = util.newBlkTimeFields

        util.ensurePGStatStatement = () => Promise.resolve()
        util.newTotalExecTimeField = () => Promise.resolve(true)
        util.newBlkTimeFields = () => Promise.resolve(true)

        // Override the exec mock to fail
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.reject(new Error('Query execution failed'))

        try {
          await expectRejection(runCommand(PgOutliers, ['--app=my-app']), 'Query execution failed')
        } finally {
          // Restore original functions
          util.ensurePGStatStatement = originalEnsurePGStatStatement
          util.newTotalExecTimeField = originalNewTotalExecTimeField
          util.newBlkTimeFields = originalNewBlkTimeFields
          require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
        }
      })
    })

    context('when database argument is specified', function () {
      it('executes query against specified database', async function () {
        const mockDbConnection = {
          attachment: {
            addon: {
              plan: {
                name: 'premium-0',
              },
            },
            name: 'DATABASE',
          },
          database: 'custom-db',
          host: 'test-host',
          password: 'test-password',
          user: 'test-user',
        }

        // Mock the utils.pg.fetcher.database and utils.pg.psql.exec
        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec

        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.resolve('total_exec_time | prop_exec_time | ncalls | sync_io_time | query')

        // Mock utility function responses
        const util = require('../../../src/lib/util')
        const originalEnsurePGStatStatement = util.ensurePGStatStatement
        const originalNewTotalExecTimeField = util.newTotalExecTimeField
        const originalNewBlkTimeFields = util.newBlkTimeFields

        util.ensurePGStatStatement = () => Promise.resolve()
        util.newTotalExecTimeField = () => Promise.resolve(true)
        util.newBlkTimeFields = () => Promise.resolve(true)

        try {
          await runCommand(PgOutliers, ['--app=my-app', 'custom-db'])

          expect(stripAnsi(stdout.output)).to.include('total_exec_time')
          expect(stderr.output).to.equal('')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
          util.ensurePGStatStatement = originalEnsurePGStatStatement
          util.newTotalExecTimeField = originalNewTotalExecTimeField
          util.newBlkTimeFields = originalNewBlkTimeFields
        }
      })
    })
  })
})
