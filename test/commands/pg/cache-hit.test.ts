import {Config} from '@oclif/core'
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'

import CacheHit from '../../../dist/commands/pg/cache-hit'

// Configure chai plugins
chai.use(chaiAsPromised)
chai.use(sinonChai)

describe('pg:cache-hit', function () {
  const {expect} = chai
  let sandbox: sinon.SinonSandbox

  beforeEach(function () {
    sandbox = sinon.createSandbox()
  })

  afterEach(function () {
    sandbox.restore()
  })

  describe('Command Class', function () {
    it('should have correct description', function () {
      expect(CacheHit.description).to.equal('show index and table hit rate')
    })

    it('should have required app flag', function () {
      expect(CacheHit.flags.app.required).to.be.true
    })

    it('should have optional database argument', function () {
      expect(CacheHit.args.database.required).to.be.false
      expect(CacheHit.args.database.description).to.equal('database to run command against')
    })

    it('should have optional remote flag', function () {
      expect(CacheHit.flags.remote).to.exist
    })

    it('should contain cache hit analysis query', function () {
      const config = new Config({root: process.cwd()})
      const command = new CacheHit([], config)
      const {query} = command as unknown as Record<string, unknown>

      expect(query).to.include('SELECT')
      expect(query).to.include('index hit rate')
      expect(query).to.include('table hit rate')
      expect(query).to.include('FROM pg_statio_user_indexes')
      expect(query).to.include('FROM pg_statio_user_tables')
      expect(query).to.include('UNION ALL')
    })
  })

  describe('Command Instance', function () {
    it('should create instance with correct properties', function () {
      const config = new Config({root: process.cwd()})
      const command = new CacheHit([], config)

      expect(command).to.be.instanceOf(CacheHit)
      expect(command).to.have.property('query')
      expect(command).to.have.property('run')
      expect(typeof command.run).to.equal('function')
    })
  })
})
