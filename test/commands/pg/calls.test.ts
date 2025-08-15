import {expect} from 'chai'
import {disableNetConnect, enableNetConnect} from 'nock'
import sinon from 'sinon'
import {stderr, stdout} from 'stdout-stderr'

// Import TypeScript source
import PgCalls from '../../../src/commands/pg/calls'
import {setupComplexCommandMocks} from '../../helpers/mock-utils'
import stripAnsi from '../../helpers/strip-ansi'
import {runCommand} from '../../run-command'

// Temporarily disable nock to see real errors
enableNetConnect()

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

describe('pg:calls', function () {
  let sandbox: sinon.SinonSandbox
  let cleanupMocks: (() => void) | undefined

  beforeEach(function () {
    sandbox = sinon.createSandbox()

    // Setup mocks for complex command with utility dependencies
    const mocks = setupComplexCommandMocks(sandbox, {
      ensurePGStatStatement: () => Promise.resolve(),
      newBlkTimeFields: () => Promise.resolve(true),
      newTotalExecTimeField: () => Promise.resolve(true),
    })

    cleanupMocks = mocks.cleanupMocks
  })

  afterEach(function () {
    if (cleanupMocks) cleanupMocks()
    sandbox.restore()
  })

  after(function () {
    // Re-enable nock for other tests
    disableNetConnect()
  })

  context('when the --app flag is specified', function () {
    context('when query execution statistics are available', function () {
      it('shows top 10 queries by execution frequency', async function () {
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
total_exec_time | prop_exec_time | ncalls | sync_io_time | query
----------------|----------------|--------|--------------|-------
00:00:01.234   | 25.0%          | 1,234  | 00:00:00.123 | SELECT * FROM users WHERE id = $1
00:00:00.567   | 15.0%          | 567    | 00:00:00.056 | UPDATE users SET last_login = NOW()
        `)

        try {
          await runCommand(PgCalls, ['--app=my-app'])

          expect(stripAnsi(stdout.output)).to.include('total_exec_time | prop_exec_time | ncalls | sync_io_time | query')
          expect(stripAnsi(stdout.output)).to.include('00:00:01.234   | 25.0%          | 1,234  | 00:00:00.123 | SELECT * FROM users WHERE id = $1')
          expect(stderr.output).to.equal('')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
        }
      })
    })

    context('when truncate flag is specified', function () {
      it('shows truncated queries', async function () {
        const mockDbConnection = {
          attachment: {name: 'DATABASE'},
          plan: {name: 'premium-0'},
        }

        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec

        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.resolve(`
total_exec_time | prop_exec_time | ncalls | sync_io_time | query
----------------|----------------|--------|--------------|-------
00:00:01.234   | 25.0%          | 1,234  | 00:00:00.123 | SELECT * FROM users WHERE id = $1…
        `)

        try {
          await runCommand(PgCalls, ['--app=my-app', '--truncate'])

          expect(stripAnsi(stdout.output)).to.include('SELECT * FROM users WHERE id = $1…')
          expect(stderr.output).to.equal('')
        } finally {
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
        }
      })
    })

    context('when no query statistics are available', function () {
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
          await runCommand(PgCalls, ['--app=my-app'])

          expect(stripAnsi(stdout.output)).to.equal('\n')
          expect(stderr.output).to.equal('')
        } finally {
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
          await expectRejection(runCommand(PgCalls, ['--app=my-app']), 'Database connection failed')
        } finally {
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
        }
      })
    })

    context('when pg_stat_statements extension is not available', function () {
      it('shows error message', async function () {
        // Mock the database connection first
        const mockDbConnection = {
          attachment: {name: 'DATABASE'},
          plan: {name: 'premium-0'},
        }

        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)

        // Override the specific utility function to simulate an error
        const utilModule = require('../../../src/lib/util')
        const originalEnsurePGStatStatement = utilModule.ensurePGStatStatement
        utilModule.ensurePGStatStatement = () => Promise.reject(new Error('pg_stat_statements extension not available'))

        try {
          await expectRejection(runCommand(PgCalls, ['--app=my-app']), 'pg_stat_statements extension not available')
        } finally {
          utilModule.ensurePGStatStatement = originalEnsurePGStatStatement
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
          await expectRejection(runCommand(PgCalls, ['--app=my-app']), 'Query execution failed')
        } finally {
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
        }
      })
    })
  })
})
