import {Config} from '@oclif/core'
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'

import Blocking from '../../../dist/commands/pg/blocking.js'

// Configure chai plugins
chai.use(chaiAsPromised)
chai.use(sinonChai)

describe('pg:blocking', function () {
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
      expect(Blocking.description).to.equal('display queries holding locks other queries are waiting to be released')
    })

    it('should have required app flag', function () {
      expect(Blocking.flags.app.required).to.be.true
    })

    it('should have optional database argument', function () {
      expect(Blocking.args.database.required).to.be.false
      expect(Blocking.args.database.description).to.equal('database to run command against')
    })

    it('should have optional remote flag', function () {
      expect(Blocking.flags.remote).to.exist
    })

    it('should contain blocking analysis query', function () {
      const config = new Config({root: process.cwd()})
      const command = new Blocking([], config)
      const {query} = command as unknown as Record<string, unknown>

      expect(query).to.include('SELECT bl.pid AS blocked_pid')
      expect(query).to.include('FROM pg_catalog.pg_locks bl')
      expect(query).to.include('JOIN pg_catalog.pg_stat_activity a')
      expect(query).to.include('WHERE NOT bl.granted')
    })
  })

  describe('Command Instance', function () {
    it('should create instance with correct properties', function () {
      const config = new Config({root: process.cwd()})
      const command = new Blocking([], config)

      expect(command).to.be.instanceOf(Blocking)
      expect(command).to.have.property('query')
      expect(command).to.have.property('run')
      expect(typeof command.run).to.equal('function')
    })
  })
})
