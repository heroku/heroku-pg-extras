import {Config} from '@oclif/core'
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'

import Calls from '../../../dist/commands/pg/calls.js'

// Configure chai plugins
chai.use(chaiAsPromised)
chai.use(sinonChai)

describe('pg:calls', function () {
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
      expect(Calls.description).to.equal('show 10 queries that have highest frequency of execution')
    })

    it('should have required app flag', function () {
      expect(Calls.flags.app.required).to.be.true
    })

    it('should have optional database argument', function () {
      expect(Calls.args.database.required).to.be.false
      expect(Calls.args.database.description).to.equal('database to run command against')
    })

    it('should have optional remote flag', function () {
      expect(Calls.flags.remote).to.exist
    })

    it('should have truncate flag', function () {
      expect(Calls.flags.truncate).to.exist
      expect(Calls.flags.truncate.char).to.equal('t')
      expect(Calls.flags.truncate.description).to.equal('truncate queries to 40 characters')
    })
  })

  describe('Command Instance', function () {
    it('should create instance with correct properties', function () {
      const config = new Config({root: process.cwd()})
      const command = new Calls([], config)

      expect(command).to.be.instanceOf(Calls)
      expect(command).to.have.property('run')
      expect(typeof command.run).to.equal('function')
    })
  })
})
