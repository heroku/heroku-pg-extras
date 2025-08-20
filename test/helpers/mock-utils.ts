import type {ConnectionDetailsWithAttachment} from '@heroku/heroku-cli-util'

import {CLIError} from '@oclif/core/lib/errors'
import {expect} from 'chai'
import sinon from 'sinon'

// Convenience function for simple commands (used with runCommand)
export function setupSimpleCommandMocks(sandbox: sinon.SinonSandbox) {
  const utils = require('@heroku/heroku-cli-util')

  // Ensure the pg module is available
  if (!utils.utils?.pg?.fetcher || !utils.utils?.pg?.psql) {
    throw new Error('Heroku CLI utils pg module not properly loaded')
  }

  const databaseStub = sandbox.stub(utils.utils.pg.fetcher, 'database')
  const execStub = sandbox.stub(utils.utils.pg.psql, 'exec')

  // Set default successful responses with proper structure for essentialNumPlan
  databaseStub.resolves({
    attachment: {
      addon: {
        plan: {name: 'heroku-postgresql:premium-0'},
      },
      name: 'DATABASE',
    },
    plan: {name: 'premium-0'},
  })
  execStub.resolves('mock output')

  return {database: databaseStub, exec: execStub}
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
