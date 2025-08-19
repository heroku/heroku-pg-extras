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

  // Set default successful responses
  databaseStub.resolves({
    attachment: {name: 'DATABASE'},
    plan: {name: 'premium-0'},
  })
  execStub.resolves('mock output')

  return {database: databaseStub, exec: execStub}
}

// Test helper functions for common error handling tests
export async function testDatabaseConnectionFailure(
  commandClass: unknown,
  args: string[],
  databaseStub: sinon.SinonStub
) {
  databaseStub.rejects(new Error('Database connection failed'))

  try {
    const {runCommand} = require('../run-command')
    await runCommand(commandClass, args)
    expect.fail('Should have thrown an error when database connection fails')
  } catch (error: unknown) {
    expect(error).to.be.instanceOf(Error)
  }
}

export async function testSQLExecutionFailure(
  commandClass: unknown,
  args: string[],
  execStub: sinon.SinonStub
) {
  execStub.rejects(new Error('SQL execution failed'))

  try {
    const {runCommand} = require('../run-command')
    await runCommand(commandClass, args)
    expect.fail('Should have thrown an error when SQL execution fails')
  } catch (error: unknown) {
    expect(error).to.be.instanceOf(Error)
  }
}
