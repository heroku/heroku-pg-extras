import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgRecordsRank, {generateRecordsRankQuery} from '../../../src/commands/pg/records-rank'
import {setupSimpleCommandMocks} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:records-rank', function () {
  let sandbox: SinonSandbox
  let execStub: SinonStub
  const {env} = process

  beforeEach(function () {
    process.env = {}
    sandbox = sinon.createSandbox()

    const mocks = setupSimpleCommandMocks(sandbox)
    execStub = mocks.exec

    const mockOutput = `
name | estimated_count
-----|----------------
users | 10000
posts | 5000
comments | 25000
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
  relname AS name,
  n_live_tup AS estimated_count
FROM
  pg_stat_user_tables
ORDER BY
  n_live_tup DESC;`.trim()

      const actualQuery = generateRecordsRankQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should order by estimated count descending', function () {
      const query = generateRecordsRankQuery()
      expect(query).to.contain('ORDER BY')
      expect(query).to.contain('n_live_tup DESC')
    })

    it('should select table name and estimated count', function () {
      const query = generateRecordsRankQuery()
      expect(query).to.contain('relname AS name')
      expect(query).to.contain('n_live_tup AS estimated_count')
    })
  })

  describe('Command Behavior', function () {
    it('displays records rank information', async function () {
      await runCommand(PgRecordsRank, ['--app', 'my-app'])
      expect(stdout.output).to.eq(heredoc`
name | estimated_count
-----|----------------
users | 10000
posts | 5000
comments | 25000
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
      require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.reject(new Error('Database connection failed'))

      try {
        await expectRejection(runCommand(PgRecordsRank, ['--app', 'my-app']), 'Database connection failed')
      } finally {
        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
      }
    })

    it('handles SQL execution failures gracefully', async function () {
      const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec
      require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.reject(new Error('Query execution failed'))

      try {
        await expectRejection(runCommand(PgRecordsRank, ['--app', 'my-app']), 'Query execution failed')
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
