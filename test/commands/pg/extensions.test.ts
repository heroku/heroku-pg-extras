import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgExtensions, {generateExtensionsQuery} from '../../../src/commands/pg/extensions'
import {
  createMockDbConnection, setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure,
} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:extensions', function () {
  let sandbox: SinonSandbox
  let databaseStub: SinonStub
  let execStub: SinonStub
  const {env} = process

  beforeEach(function () {
    process.env = {}
    sandbox = sinon.createSandbox()

    // Setup Heroku CLI utils mocks
    const mocks = setupSimpleCommandMocks(sandbox)
    databaseStub = mocks.database
    execStub = mocks.exec

    // Override the exec stub to return specific extensions output
    const mockOutput = `
name | version | schema | description
-----|---------|--------|-------------
plpgsql | 1.0 | pg_catalog | PL/pgSQL procedural language
uuid-ossp | 1.1 | public | generate universally unique identifiers
`.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query for essential plans', async function () {
      const mockDbConnection = createMockDbConnection('heroku-postgresql:essential-0')
      const expectedQuery = `SELECT *
                     FROM pg_available_extensions
                     WHERE name IN (SELECT unnest(string_to_array(current_setting('rds.allowed_extensions'), ',')))`

      const actualQuery = generateExtensionsQuery(mockDbConnection)
      expect(actualQuery).to.equal(expectedQuery)
    })

    it('should generate exact expected SQL query for standard plans', async function () {
      const mockDbConnection = createMockDbConnection('heroku-postgresql:premium-0')
      const expectedQuery = `SELECT *
                     FROM pg_available_extensions
                     WHERE name IN (SELECT unnest(string_to_array(current_setting('extwlist.extensions'), ',')))`

      const actualQuery = generateExtensionsQuery(mockDbConnection)
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should restrict extensions for essential plans', async function () {
      const mockDbConnection = createMockDbConnection('heroku-postgresql:essential-0')
      const query = generateExtensionsQuery(mockDbConnection)

      // Essential plans should have restricted extension list
      expect(query).to.contain('rds.allowed_extensions')
    })

    it('should show all extensions for standard plans', async function () {
      const mockDbConnection = createMockDbConnection('heroku-postgresql:premium-0')
      const query = generateExtensionsQuery(mockDbConnection)

      // Standard plans should show all extensions
      expect(query).to.contain('extwlist.extensions')
    })
  })

  describe('Command Behavior', function () {
    it('displays extensions information', async function () {
      await runCommand(PgExtensions, ['--app', 'my-app'])

      expect(stdout.output).to.eq(heredoc`
        name | version | schema | description
        -----|---------|--------|-------------
        plpgsql | 1.0 | pg_catalog | PL/pgSQL procedural language
        uuid-ossp | 1.1 | public | generate universally unique identifiers
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgExtensions, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgExtensions, ['--app', 'my-app'], execStub)
    })
  })
})
