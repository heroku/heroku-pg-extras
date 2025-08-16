import {expect} from 'chai'
import {stderr, stdout} from 'stdout-stderr'

import PgStatsReset from '../../../src/commands/pg/stats-reset'
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

describe('pg:stats-reset', function () {
  const {env} = process

  beforeEach(function () {
    process.env = {}
  })

  afterEach(function () {
    process.env = env
  })

  context('when the --app flag is specified', function () {
    context('when stats reset executes successfully', function () {
      it('shows success message', async function () {
        // Mock the database connection
        const mockDbConnection = {
          attachment: {
            addon: {
              name: 'test-database',
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

        // Mock utility function responses
        const util = require('../../../src/lib/util')
        const originalEnsureEssentialTierPlan = util.ensureEssentialTierPlan

        util.ensureEssentialTierPlan = () => Promise.resolve()

        // Mock the heroku.put method
        const mockHeroku = {
          put: () => Promise.resolve({message: 'Statistics reset successfully'}),
        }

        // Override the heroku property on the command
        const originalRequire = require
        const mockModule = {
          ...originalRequire('../../../src/commands/pg/stats-reset'),
          default: class extends originalRequire('../../../src/commands/pg/stats-reset').default {
            get heroku() {
              return mockHeroku
            }
          },
        }

        try {
          // Use a different approach - mock the entire module
          const PgStatsResetMocked = mockModule.default
          await runCommand(PgStatsResetMocked, ['--app=my-app'])

          expect(stripAnsi(stdout.output)).to.include('Statistics reset successfully')
          expect(stderr.output).to.equal('')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          util.ensureEssentialTierPlan = originalEnsureEssentialTierPlan
        }
      })
    })

    context('when database connection fails', function () {
      it('shows error message', async function () {
        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.reject(new Error('Database connection failed'))

        try {
          await expectRejection(runCommand(PgStatsReset, ['--app=my-app']), 'Database connection failed')
        } finally {
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
        }
      })
    })

    context('when essential tier plan check fails', function () {
      it('shows error message', async function () {
        const mockDbConnection = {
          attachment: {
            addon: {
              name: 'test-database',
              plan: {
                name: 'essential-0',
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
        const originalEnsureEssentialTierPlan = util.ensureEssentialTierPlan

        util.ensureEssentialTierPlan = () => Promise.reject(new Error('This operation is not supported by Essential-tier databases'))

        try {
          await expectRejection(runCommand(PgStatsReset, ['--app=my-app']), 'This operation is not supported by Essential-tier databases')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          util.ensureEssentialTierPlan = originalEnsureEssentialTierPlan
        }
      })
    })

    context('when HTTP request fails', function () {
      it('shows error message', async function () {
        // Mock the database connection
        const mockDbConnection = {
          attachment: {
            addon: {
              name: 'test-database',
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

        // Mock utility function responses
        const util = require('../../../src/lib/util')
        const originalEnsureEssentialTierPlan = util.ensureEssentialTierPlan

        util.ensureEssentialTierPlan = () => Promise.resolve()

        // Mock the heroku.put method to fail
        const mockHeroku = {
          put: () => Promise.reject(new Error('HTTP request failed')),
        }

        // Override the heroku property on the command
        const originalRequire = require
        const mockModule = {
          ...originalRequire('../../../src/commands/pg/stats-reset'),
          default: class extends originalRequire('../../../src/commands/pg/stats-reset').default {
            get heroku() {
              return mockHeroku
            }
          },
        }

        try {
          // Use a different approach - mock the entire module
          const PgStatsResetMocked = mockModule.default
          await expectRejection(runCommand(PgStatsResetMocked, ['--app=my-app']), 'HTTP request failed')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          util.ensureEssentialTierPlan = originalEnsureEssentialTierPlan
        }
      })
    })

    context('when database argument is specified', function () {
      it('executes reset against specified database', async function () {
        // Mock the database connection
        const mockDbConnection = {
          attachment: {
            addon: {
              name: 'custom-database',
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

        // Mock the utils.pg.fetcher.database
        const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.resolve(mockDbConnection)

        // Mock utility function responses
        const util = require('../../../src/lib/util')
        const originalEnsureEssentialTierPlan = util.ensureEssentialTierPlan

        util.ensureEssentialTierPlan = () => Promise.resolve()

        // Mock the heroku.put method
        const mockHeroku = {
          put: () => Promise.resolve({message: 'Custom database statistics reset successfully'}),
        }

        // Override the heroku property on the command
        const originalRequire = require
        const mockModule = {
          ...originalRequire('../../../src/commands/pg/stats-reset'),
          default: class extends originalRequire('../../../src/commands/pg/stats-reset').default {
            get heroku() {
              return mockHeroku
            }
          },
        }

        try {
          // Use a different approach - mock the entire module
          const PgStatsResetMocked = mockModule.default
          await runCommand(PgStatsResetMocked, ['--app=my-app', 'custom-db'])

          expect(stripAnsi(stdout.output)).to.include('Custom database statistics reset successfully')
          expect(stderr.output).to.equal('')
        } finally {
          // Restore original functions
          require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
          util.ensureEssentialTierPlan = originalEnsureEssentialTierPlan
        }
      })
    })
  })
})
