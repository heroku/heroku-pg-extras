import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgTotalIndexSize, {generateTotalIndexSizeQuery} from '../../../src/commands/pg/total-index-size'
import {setupSimpleCommandMocks} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:total-index-size', function () {
  let sandbox: SinonSandbox
  let execStub: SinonStub
  const {env} = process

  beforeEach(function () {
    process.env = {}
    sandbox = sinon.createSandbox()

    const mocks = setupSimpleCommandMocks(sandbox)
    execStub = mocks.exec

    const mockOutput = `
size
-----
15.2 MB
    `.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const expectedQuery = `SELECT pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size
FROM pg_class c
LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
AND n.nspname !~ '^pg_toast'
AND c.relkind='i';`.trim()

      const actualQuery = generateTotalIndexSizeQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should exclude system schemas from index analysis', function () {
      const query = generateTotalIndexSizeQuery()
      expect(query).to.contain("n.nspname NOT IN ('pg_catalog', 'information_schema')")
      expect(query).to.contain("n.nspname !~ '^pg_toast'")
    })

    it('should only include indexes', function () {
      const query = generateTotalIndexSizeQuery()
      expect(query).to.contain("c.relkind='i'")
    })

    it('should calculate total index size correctly', function () {
      const query = generateTotalIndexSizeQuery()
      expect(query).to.contain('sum(c.relpages::bigint*8192)')
      expect(query).to.contain('pg_size_pretty')
    })
  })

  describe('Command Behavior', function () {
    it('displays total index size information', async function () {
      await runCommand(PgTotalIndexSize, ['--app', 'my-app'])
      expect(stdout.output).to.eq(heredoc`
size
-----
15.2 MB
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      const originalFetcher = require('@heroku/heroku-cli-util').utils.pg.fetcher.database
      require('@heroku/heroku-cli-util').utils.pg.fetcher.database = () => Promise.reject(new Error('Database connection failed'))

      try {
        await expectRejection(runCommand(PgTotalIndexSize, ['--app', 'my-app']), 'Database connection failed')
      } finally {
        require('@heroku/heroku-cli-util').utils.pg.fetcher.database = originalFetcher
      }
    })

    it('handles SQL execution failures gracefully', async function () {
      const originalExec = require('@heroku/heroku-cli-util').utils.pg.psql.exec
      require('@heroku/heroku-cli-util').utils.pg.psql.exec = () => Promise.reject(new Error('Query execution failed'))

      try {
        await expectRejection(runCommand(PgTotalIndexSize, ['--app', 'my-app']), 'Query execution failed')
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
