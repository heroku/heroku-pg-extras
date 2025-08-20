import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'

import PgSeqScans, {generateSeqScansQuery} from '../../../src/commands/pg/seq-scans'
import {setupSimpleCommandMocks} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:seq-scans', function () {
  let sandbox: SinonSandbox
  let execStub: SinonStub
  const {env} = process

  beforeEach(function () {
    process.env = {}
    sandbox = sinon.createSandbox()

    const mocks = setupSimpleCommandMocks(sandbox)
    execStub = mocks.exec

    const mockOutput = `
name | count
-----|-------
users | 150
posts | 75
comments | 25
    `.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const expectedQuery = `SELECT relname AS name,
       seq_scan as count
FROM
  pg_stat_user_tables
ORDER BY seq_scan DESC;`.trim()

      const actualQuery = generateSeqScansQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should order by sequential scan count descending', function () {
      const query = generateSeqScansQuery()
      expect(query).to.contain('ORDER BY')
      expect(query).to.contain('seq_scan DESC')
    })

    it('should select table name and scan count', function () {
      const query = generateSeqScansQuery()
      expect(query).to.contain('relname AS name')
      expect(query).to.contain('seq_scan as count')
    })
  })

  describe('Command Behavior', function () {
    it('displays sequential scans information', async function () {
      await runCommand(PgSeqScans, ['--app', 'my-app'])
      expect(stdout.output).to.contain('name | count')
      expect(stdout.output).to.contain('users | 150')
      expect(stdout.output).to.contain('posts | 75')
      expect(stdout.output).to.contain('comments | 25')
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
      require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.reject(new Error('Database connection failed'))

      try {
        await expectRejection(runCommand(PgSeqScans, ['--app', 'my-app']), 'Database connection failed')
      } finally {
        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
      }
    })

    it('handles SQL execution failures gracefully', async function () {
      const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec
      require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.reject(new Error('Query execution failed'))

      try {
        await expectRejection(runCommand(PgSeqScans, ['--app', 'my-app']), 'Query execution failed')
      } finally {
        require('@heroku/heroku-cli-util').utils.pg.psql.exec = originalExec
      }
    })
  })
})

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
