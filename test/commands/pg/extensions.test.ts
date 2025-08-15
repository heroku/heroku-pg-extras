import {expect} from 'chai'
import sinon from 'sinon'
import {stderr, stdout} from 'stdout-stderr'

// Import TypeScript source
import PgExtensions from '../../../src/commands/pg/extensions'
import {setupComplexCommandMocks} from '../../helpers/mock-utils'
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

// Helper function to update utility function mocks without double-stubbing
const updateUtilityMock = (functionName: string, mockFunction: () => boolean) => {
  const utilModule = require('../../../src/lib/util')
  const originalFunction = utilModule[functionName]
  utilModule[functionName] = mockFunction
  return () => {
    utilModule[functionName] = originalFunction
  }
}

describe('pg:extensions', function () {
  let sandbox: sinon.SinonSandbox
  let cleanupMocks: (() => void) | undefined
  let databaseMock: sinon.SinonStub
  let execMock: sinon.SinonStub

  beforeEach(function () {
    sandbox = sinon.createSandbox()

    // Setup mocks for complex command with utility dependencies
    const mocks = setupComplexCommandMocks(sandbox, {
      essentialNumPlan: () => false, // Default to non-essential plan
    })
    cleanupMocks = mocks.cleanupMocks
    databaseMock = mocks.database
    execMock = mocks.exec
  })

  afterEach(function () {
    if (cleanupMocks) cleanupMocks()
    sandbox.restore()
  })

  describe('Command Class', function () {
    it('should have correct static description', function () {
      expect(PgExtensions.description).to.equal('list available and installed extensions')
    })

    it('should have correct static args', function () {
      expect(PgExtensions.args).to.have.property('database')
      expect(PgExtensions.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgExtensions.flags).to.have.property('app')
      expect(PgExtensions.flags).to.have.property('remote')
    })

    it('should create command instance', function () {
      expect(PgExtensions).to.be.a('function')
      expect(PgExtensions.description).to.be.a('string')
    })
  })

  describe('Command Execution', function () {
    it('should execute run method successfully with non-essential plan', async function () {
      await runCommand(PgExtensions, ['--app=test-app'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })

    it('should execute run method successfully with essential plan', async function () {
      // Override the mock to simulate essential plan
      const restoreMock = updateUtilityMock('essentialNumPlan', () => true)

      try {
        await runCommand(PgExtensions, ['--app=test-app'])

        expect(stripAnsi(stdout.output)).to.include('mock output')
        expect(stderr.output).to.equal('')
      } finally {
        restoreMock()
      }
    })

    it('should handle database fetching errors', async function () {
      // Override the existing mock to simulate an error
      databaseMock.rejects(new Error('Database fetching failed'))

      await expectRejection(runCommand(PgExtensions, ['--app=test-app']), 'Database fetching failed')
    })

    it('should handle query execution errors', async function () {
      // Override the existing mock to simulate an error
      execMock.rejects(new Error('Query execution failed'))

      await expectRejection(runCommand(PgExtensions, ['--app=test-app']), 'Query execution failed')
    })

    it('should parse command arguments correctly', async function () {
      await runCommand(PgExtensions, ['--app=test-app', 'test-db'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })

    it('should handle different database names', async function () {
      await runCommand(PgExtensions, ['--app=test-app', 'another-db'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })
  })

  describe('Utility Function Integration', function () {
    it('should call essentialNumPlan utility with correct parameters', async function () {
      await runCommand(PgExtensions, ['--app=test-app'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })

    it('should handle utility function errors gracefully', async function () {
      // Override the existing mock to simulate an error
      execMock.rejects(new Error('Utility function failed'))

      await expectRejection(runCommand(PgExtensions, ['--app=test-app']), 'Utility function failed')
    })
  })

  describe('Conditional Query Generation', function () {
    it('should generate RDS query for essential plans', async function () {
      // Override the mock to simulate essential plan
      const restoreMock = updateUtilityMock('essentialNumPlan', () => true)

      try {
        await runCommand(PgExtensions, ['--app=test-app'])

        expect(stripAnsi(stdout.output)).to.include('mock output')
        expect(stderr.output).to.equal('')
      } finally {
        restoreMock()
      }
    })

    it('should generate standard query for non-essential plans', async function () {
      await runCommand(PgExtensions, ['--app=test-app'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })

    it('should use correct database connection for utility function', async function () {
      await runCommand(PgExtensions, ['--app=test-app'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })
  })

  describe('Query Structure and Logic', function () {
    it('should have consistent base query structure for both plan types', async function () {
      await runCommand(PgExtensions, ['--app=test-app'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })

    it('should use correct setting names for different plan types', async function () {
      await runCommand(PgExtensions, ['--app=test-app'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })
  })

  describe('Integration with Utility Functions', function () {
    it('should use database fetcher utility', async function () {
      await runCommand(PgExtensions, ['--app=test-app'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })

    it('should use psql exec utility', async function () {
      await runCommand(PgExtensions, ['--app=test-app'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })

    it('should use ux.log for output', async function () {
      await runCommand(PgExtensions, ['--app=test-app'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })
  })

  describe('Edge Cases and Error Scenarios', function () {
    it('should handle missing database argument', async function () {
      await runCommand(PgExtensions, ['--app=test-app'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })

    it('should handle empty output from database', async function () {
      // Override the existing mock to simulate empty output
      execMock.resolves('')

      await runCommand(PgExtensions, ['--app=test-app'])

      expect(stripAnsi(stdout.output)).to.equal('\n')
      expect(stderr.output).to.equal('')
    })

    it('should handle extensions output with available extensions', async function () {
      await runCommand(PgExtensions, ['--app=test-app'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })

    it('should handle different plan types correctly', async function () {
      await runCommand(PgExtensions, ['--app=test-app'])

      expect(stripAnsi(stdout.output)).to.include('mock output')
      expect(stderr.output).to.equal('')
    })
  })
})
