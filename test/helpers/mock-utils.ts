import type {ConnectionDetailsWithAttachment} from '@heroku/heroku-cli-util'

import {CLIError} from '@oclif/core/lib/errors'
import {expect} from 'chai'
import sinon from 'sinon'

export interface MockDatabaseConnection {
  [key: string]: unknown
  attachment: {name: string}
  plan: {name: string}
}

export interface MockUtilityFunctions {
  ensurePGStatStatement?: () => Promise<void>
  essentialNumPlan?: (addon: unknown) => boolean
  newBlkTimeFields?: () => Promise<boolean>
  newTotalExecTimeField?: () => Promise<boolean>
}

export class MockUtils {
  private sandbox: sinon.SinonSandbox

  constructor(sandbox: sinon.SinonSandbox) {
    this.sandbox = sandbox
  }

  // Mock database connection
  mockDatabaseConnection(overrides: Partial<MockDatabaseConnection> = {}): MockDatabaseConnection {
    return {
      attachment: {name: 'DATABASE'},
      plan: {name: 'premium-0'},
      ...overrides,
    }
  }

  // Mock Heroku CLI utils
  mockHerokuUtils(): {
    database: sinon.SinonStub
    exec: sinon.SinonStub
    } {
    const utils = require('@heroku/heroku-cli-util')

    // Ensure the pg module is available
    if (!utils.utils?.pg?.fetcher || !utils.utils?.pg?.psql) {
      throw new Error('Heroku CLI utils pg module not properly loaded')
    }

    const databaseStub = this.sandbox.stub(utils.utils.pg.fetcher, 'database')
    const execStub = this.sandbox.stub(utils.utils.pg.psql, 'exec')

    return {database: databaseStub, exec: execStub}
  }

  // Mock utility functions from TypeScript source at runtime
  mockUtilityFunctionsAtRuntime(mocks: MockUtilityFunctions): () => void {
    const utilModule = require('../../src/lib/util')

    // Store original functions
    const originalFunctions: Record<string, unknown> = {}

    Object.entries(mocks).forEach(([functionName, mockFunction]) => {
      if (mockFunction) {
        originalFunctions[functionName] = utilModule[functionName]
        // Replace the function directly
        utilModule[functionName] = mockFunction
      }
    })

    // Return cleanup function
    return () => {
      Object.entries(originalFunctions).forEach(([functionName, originalFunction]) => {
        utilModule[functionName] = originalFunction
      })
    }
  }

  // Mock utility functions using sinon stubs (alternative approach)
  mockUtilityFunctionsWithStubs(mocks: MockUtilityFunctions): void {
    const utilModule = require('../../src/lib/util')

    Object.entries(mocks).forEach(([functionName, mockFunction]) => {
      if (mockFunction) {
        this.sandbox.stub(utilModule, functionName).callsFake(mockFunction)
      }
    })
  }

  // Reset all mocks
  reset(): void {
    this.sandbox.restore()
  }
}

// Convenience function for simple commands (used with runCommand)
export function setupSimpleCommandMocks(sandbox: sinon.SinonSandbox) {
  const mockUtils = new MockUtils(sandbox)
  const {database, exec} = mockUtils.mockHerokuUtils()

  // Set default successful responses
  database.resolves(mockUtils.mockDatabaseConnection())
  exec.resolves('mock output')

  return {database, exec, mockUtils}
}

// Convenience function for complex commands (used with runCommand)
export function setupComplexCommandMocks(sandbox: sinon.SinonSandbox, utilityMocks: MockUtilityFunctions) {
  const mockUtils = new MockUtils(sandbox)
  const {database, exec} = mockUtils.mockHerokuUtils()

  // Set default successful responses
  database.resolves(mockUtils.mockDatabaseConnection())
  exec.resolves('mock output')

  // Mock utility functions at runtime
  const cleanupMocks = mockUtils.mockUtilityFunctionsAtRuntime(utilityMocks)

  return {
    cleanupMocks,
    database,
    exec,
    mockUtils,
  }
}

// Helper function to create properly typed mock database connections
export function createMockDbConnection(planName: string): ConnectionDetailsWithAttachment {
  return {
    attachment: {
      addon: {
        plan: {name: planName},
      },
    },
  } as ConnectionDetailsWithAttachment
}

// Test helper functions for common error handling tests
export async function testDatabaseConnectionFailure(
  commandClass: unknown,
  args: string[],
  databaseStub: sinon.SinonStub
) {
  databaseStub.rejects(new CLIError('Database connection failed'))

  try {
    const {runCommand} = require('../run-command')
    await runCommand(commandClass, args)
    expect.fail('Should have thrown an error when database connection fails')
  } catch (error: unknown) {
    expect(error).to.be.instanceOf(CLIError)
    expect((error as CLIError).message).to.include('Database connection failed')
  }
}

export async function testSQLExecutionFailure(
  commandClass: unknown,
  args: string[],
  execStub: sinon.SinonStub
) {
  execStub.rejects(new CLIError('SQL execution failed'))

  try {
    const {runCommand} = require('../run-command')
    await runCommand(commandClass, args)
    expect.fail('Should have thrown an error when SQL execution fails')
  } catch (error: unknown) {
    expect(error).to.be.instanceOf(CLIError)
    const errorMessage = (error as CLIError).message
    // Handle different error messages based on where the failure occurs
    const expectedMessages = [
      'SQL execution failed',
      'Failed to check pg_stat_statements extension availability',
    ]
    const hasExpectedMessage = expectedMessages.some(msg => errorMessage.includes(msg))
    expect(hasExpectedMessage, `Expected error message to include one of: ${expectedMessages.join(', ')}, but got: ${errorMessage}`).to.be.true
  }
}

// Function to setup mocks before importing commands (legacy approach - not recommended)
export function setupMocksBeforeImport(utilityMocks: MockUtilityFunctions): () => void {
  // Clear the module cache to ensure fresh imports
  const utilModulePath = require.resolve('../../src/lib/util')
  delete require.cache[utilModulePath]

  // Now require the fresh module
  const utilModule = require('../../src/lib/util')

  // Store original functions
  const originalFunctions: Record<string, unknown> = {}

  // Override functions
  Object.entries(utilityMocks).forEach(([functionName, mockFunction]) => {
    if (mockFunction) {
      originalFunctions[functionName] = utilModule[functionName]
      utilModule[functionName] = mockFunction
    }
  })

  // Return cleanup function
  return () => {
    // Restore original functions
    Object.entries(originalFunctions).forEach(([functionName, originalFunction]) => {
      utilModule[functionName] = originalFunction
    })

    // Clear cache again to ensure clean state
    delete require.cache[utilModulePath]
  }
}
