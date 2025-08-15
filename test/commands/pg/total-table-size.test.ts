import {expect} from 'chai'
import {stderr, stdout} from 'stdout-stderr'

import PgTotalTableSize from '../../../src/commands/pg/total-table-size'
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

describe('pg:total-table-size', function () {
  const {env} = process

  beforeEach(function () {
    process.env = {}
  })

  afterEach(function () {
    process.env = env
  })

  context('when the --app flag is specified', function () {
    context('when total table size query executes successfully', function () {
      it('shows total table size information', async function () {
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
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.resolve('users | 75 MB\nposts | 40 MB\ncomments | 15 MB')

        try {
          await runCommand(PgTotalTableSize, ['--app=my-app'])

          expect(stripAnsi(stdout.output)).to.include('users | 75 MB')
          expect(stripAnsi(stdout.output)).to.include('posts | 40 MB')
          expect(stripAnsi(stdout.output)).to.include('comments | 15 MB')
          expect(stderr.output).to.equal('')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
        }
      })
    })

    context('when database connection fails', function () {
      it('shows error message', async function () {
        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.reject(new Error('Database connection failed'))

        try {
          await expectRejection(runCommand(PgTotalTableSize, ['--app=my-app']), 'Database connection failed')
        } finally {
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
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

        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec

        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.reject(new Error('Query execution failed'))

        try {
          await expectRejection(runCommand(PgTotalTableSize, ['--app=my-app']), 'Query execution failed')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
        }
      })
    })

    context('when no tables are found', function () {
      it('shows empty result', async function () {
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

        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec

        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.resolve('')

        try {
          await runCommand(PgTotalTableSize, ['--app=my-app'])

          expect(stripAnsi(stdout.output)).to.equal('\n')
          expect(stderr.output).to.equal('')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
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

        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec

        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.resolve('custom_table | 150 MB')

        try {
          await runCommand(PgTotalTableSize, ['--app=my-app', 'custom-db'])

          expect(stripAnsi(stdout.output)).to.include('custom_table | 150 MB')
          expect(stderr.output).to.equal('')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
        }
      })
    })
  })
})
