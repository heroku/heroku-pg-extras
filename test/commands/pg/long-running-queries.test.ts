import {expect} from 'chai'
import {stderr, stdout} from 'stdout-stderr'

import PgLongRunningQueries from '../../../src/commands/pg/long-running-queries'
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

describe('pg:long-running-queries', function () {
  const {env} = process

  beforeEach(function () {
    process.env = {}
  })

  afterEach(function () {
    process.env = env
  })

  context('when the --app flag is specified', function () {
    context('when long running queries query executes successfully', function () {
      it('shows long running queries information', async function () {
        // Mock the database connection and query execution
        const mockDbConnection = {
          attachment: {name: 'DATABASE'},
          plan: {name: 'premium-0'},
        }

        // Mock the utils.pg.fetcher.database and utils.pg.psql.exec
        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec

        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.resolve(`
pid | duration | query
----|----------|-------
123 | 00:15:30 | SELECT * FROM large_table WHERE complex_condition
789 | 00:08:45 | UPDATE users SET status = 'processing' WHERE id > 1000
        `)

        try {
          await runCommand(PgLongRunningQueries, ['--app=my-app'])

          expect(stripAnsi(stdout.output)).to.include('pid | duration | query')
          expect(stripAnsi(stdout.output)).to.include('123 | 00:15:30 | SELECT * FROM large_table WHERE complex_condition')
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
          await expectRejection(runCommand(PgLongRunningQueries, ['--app=my-app']), 'Database connection failed')
        } finally {
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
        }
      })
    })

    context('when query execution fails', function () {
      it('shows error message', async function () {
        const mockDbConnection = {
          attachment: {name: 'DATABASE'},
          plan: {name: 'premium-0'},
        }

        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec

        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.reject(new Error('Query execution failed'))

        try {
          await expectRejection(runCommand(PgLongRunningQueries, ['--app=my-app']), 'Query execution failed')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
        }
      })
    })

    context('when no long running queries are found', function () {
      it('shows empty result', async function () {
        const mockDbConnection = {
          attachment: {name: 'DATABASE'},
          plan: {name: 'premium-0'},
        }

        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec

        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.resolve('')

        try {
          await runCommand(PgLongRunningQueries, ['--app=my-app'])

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
          attachment: {name: 'DATABASE'},
          plan: {name: 'premium-0'},
        }

        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec

        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.resolve('test output')

        try {
          await runCommand(PgLongRunningQueries, ['--app=my-app', 'custom-db'])

          expect(stripAnsi(stdout.output)).to.include('test output')
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
