import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgMandelbrot, {generateMandelbrotQuery} from '../../../src/commands/pg/mandelbrot'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:mandelbrot', function () {
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

    // Override the exec stub to return specific mandelbrot output
    const mockOutput = `
array_to_string
----------------
  .,,,-----++++%%%%@@@@####
  .,,,-----++++%%%%@@@@####
  .,,,-----++++%%%%@@@@####
  .,,,-----++++%%%%@@@@####
  .,,,-----++++%%%%@@@@####
`.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const expectedQuery = `WITH RECURSIVE Z(IX, IY, CX, CY, X, Y, I) AS (
            SELECT IX, IY, X::float, Y::float, X::float, Y::float, 0
            FROM (select -2.2 + 0.031 * i, i from generate_series(0,101) as i) as xgen(x,ix),
                 (select -1.5 + 0.031 * i, i from generate_series(0,101) as i) as ygen(y,iy)
            UNION ALL
            SELECT IX, IY, CX, CY, X * X - Y * Y + CX AS X, Y * X * 2 + CY, I + 1
            FROM Z
            WHERE X * X + Y * Y < 16::float
            AND I < 100
      )
SELECT array_to_string(array_agg(SUBSTRING(' .,,,-----++++%%%%@@@@#### ', LEAST(GREATEST(I,1),27), 1)),'')
FROM (
      SELECT IX, IY, MAX(I) AS I
      FROM Z
      GROUP BY IY, IX
      ORDER BY IY, IX
     ) AS ZT
GROUP BY IY
ORDER BY IY`.trim()

      const actualQuery = generateMandelbrotQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should use recursive CTE for mandelbrot calculation', function () {
      const query = generateMandelbrotQuery()

      // Should use recursive CTE
      expect(query).to.contain('WITH RECURSIVE Z(')
      expect(query).to.contain('UNION ALL')
    })

    it('should generate coordinate series for x and y', function () {
      const query = generateMandelbrotQuery()

      // Should generate coordinate series
      expect(query).to.contain('generate_series(0,101)')
      expect(query).to.contain('-2.2 + 0.031 * i')
      expect(query).to.contain('-1.5 + 0.031 * i')
    })

    it('should implement mandelbrot iteration logic', function () {
      const query = generateMandelbrotQuery()

      // Should have mandelbrot iteration formula
      expect(query).to.contain('X * X - Y * Y + CX')
      expect(query).to.contain('Y * X * 2 + CY')
    })

    it('should limit iterations and check escape condition', function () {
      const query = generateMandelbrotQuery()

      // Should check escape condition and limit iterations
      expect(query).to.contain('X * X + Y * Y < 16::float')
      expect(query).to.contain('I < 100')
    })
  })

  describe('Command Behavior', function () {
    it('displays mandelbrot set output', async function () {
      await runCommand(PgMandelbrot, ['--app', 'my-app'])

      expect(stdout.output).to.eq(heredoc`
        array_to_string
        ----------------
          .,,,-----++++%%%%@@@@####
          .,,,-----++++%%%%@@@@####
          .,,,-----++++%%%%@@@@####
          .,,,-----++++%%%%@@@@####
          .,,,-----++++%%%%@@@@####
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgMandelbrot, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgMandelbrot, ['--app', 'my-app'], execStub)
    })
  })
})
