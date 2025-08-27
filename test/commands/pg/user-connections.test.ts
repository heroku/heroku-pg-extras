import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgUserConnections, {generateUserConnectionsQuery} from '../../../src/commands/pg/user-connections'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:user-connections', function () {
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

    // Override the exec stub to return specific user connections output
    const mockOutput = `
credential | connections
-----------|------------
postgres   | 5
app_user   | 3
    `.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const expectedQuery = `SELECT 
  usename AS credential,
  count(*) AS connections
FROM pg_stat_activity 
WHERE state = 'active'
GROUP BY usename 
ORDER BY connections DESC;`

      const actualQuery = generateUserConnectionsQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should filter for active connections only', function () {
      const query = generateUserConnectionsQuery()
      expect(query).to.contain("WHERE state = 'active'")
    })

    it('should group by username', function () {
      const query = generateUserConnectionsQuery()
      expect(query).to.contain('GROUP BY usename')
    })

    it('should order by connection count descending', function () {
      const query = generateUserConnectionsQuery()
      expect(query).to.contain('ORDER BY connections DESC')
    })

    it('should count connections per user', function () {
      const query = generateUserConnectionsQuery()
      expect(query).to.contain('count(*) AS connections')
    })
  })

  describe('Command Behavior', function () {
    it('shows user connections information', async function () {
      await runCommand(PgUserConnections, ['--app', 'my-app'])
      expect(stdout.output).to.eq(heredoc`
        credential | connections
        -----------|------------
        postgres   | 5
        app_user   | 3
      `)
      expect(stderr.output).to.eq('')
    })

    it('shows empty result when no user connections are found', async function () {
      execStub.resolves('')
      await runCommand(PgUserConnections, ['--app', 'my-app'])
      expect(stdout.output).to.eq('\n')
      expect(stderr.output).to.eq('')
    })

    it('executes query against specified database', async function () {
      execStub.resolves('custom_user | 2')
      await runCommand(PgUserConnections, ['--app', 'my-app', 'custom-db'])
      expect(stdout.output).to.contain('custom_user | 2')
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgUserConnections, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgUserConnections, ['--app', 'my-app'], execStub)
    })
  })
})
