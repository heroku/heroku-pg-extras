import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'

import PgStatsReset from '../../../src/commands/pg/stats-reset'
import * as util from '../../../src/lib/util'
import {
  createMockDbConnection, setupSimpleCommandMocks, testDatabaseConnectionFailure,
} from '../../helpers/mock-utils'
import stripAnsi from '../../helpers/strip-ansi'
import {runCommand} from '../../run-command'

describe('pg:stats-reset', function () {
  let sandbox: SinonSandbox
  let databaseStub: SinonStub
  const {env} = process

  beforeEach(function () {
    process.env = {}
    sandbox = sinon.createSandbox()

    // Setup Heroku CLI utils mocks
    const mocks = setupSimpleCommandMocks(sandbox)
    databaseStub = mocks.database
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  context('when the --app flag is specified', function () {
    context('when stats reset executes successfully', function () {
      it('shows success message', async function () {
        const mockDbConnection = createMockDbConnection('heroku-postgresql:premium-0')
        databaseStub.resolves(mockDbConnection)

        // Mock utility function responses
        sandbox.stub(util, 'ensureEssentialTierPlan').resolves()

        // Mock the heroku.put method
        const mockHeroku = {
          put: () => Promise.resolve({body: {message: 'Statistics reset successfully'}}),
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
          // Cleanup is handled by sandbox.restore()
        }
      })
    })

    context('when database connection fails', function () {
      it('shows error message', async function () {
        await testDatabaseConnectionFailure(PgStatsReset, ['--app=my-app'], databaseStub)
      })
    })

    context('when essential tier plan check fails', function () {
      it('shows error message', async function () {
        const mockDbConnection = createMockDbConnection('heroku-postgresql:essential-0')
        databaseStub.resolves(mockDbConnection)

        // Mock utility function to throw error
        sandbox.stub(util, 'ensureEssentialTierPlan').rejects(new Error('This operation is not supported by Essential-tier databases'))

        try {
          await runCommand(PgStatsReset, ['--app=my-app'])
          expect.fail('Should have thrown an error when essential tier plan check fails')
        } catch (error: unknown) {
          expect(error).to.be.instanceOf(Error)
          expect((error as Error).message).to.include('This operation is not supported by Essential-tier databases')
        }
      })
    })

    context('when HTTP request fails', function () {
      it('shows error message', async function () {
        const mockDbConnection = createMockDbConnection('heroku-postgresql:premium-0')
        databaseStub.resolves(mockDbConnection)

        // Mock utility function responses
        sandbox.stub(util, 'ensureEssentialTierPlan').resolves()

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
          await runCommand(PgStatsResetMocked, ['--app=my-app'])
          expect.fail('Should have thrown an error when HTTP request fails')
        } catch (error: unknown) {
          expect(error).to.be.instanceOf(Error)
          expect((error as Error).message).to.include('HTTP request failed')
        }
      })
    })

    context('when database argument is specified', function () {
      it('executes reset against specified database', async function () {
        const mockDbConnection = createMockDbConnection('heroku-postgresql:premium-0')
        databaseStub.resolves(mockDbConnection)

        // Mock utility function responses
        sandbox.stub(util, 'ensureEssentialTierPlan').resolves()

        // Mock the heroku.put method
        const mockHeroku = {
          put: () => Promise.resolve({body: {message: 'Custom database statistics reset successfully'}}),
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
          // Cleanup is handled by sandbox.restore()
        }
      })
    })
  })
})
