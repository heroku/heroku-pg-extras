import {Config} from '@oclif/core'
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'

import Extensions from '../../../dist/commands/pg/extensions'

// Configure chai plugins
chai.use(chaiAsPromised)
chai.use(sinonChai)

describe('pg:extensions', function () {
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
      expect(Extensions.description).to.equal('list available and installed extensions')
    })

    it('should have required app flag', function () {
      expect(Extensions.flags.app.required).to.be.true
    })

    it('should have optional database argument', function () {
      expect(Extensions.args.database.required).to.be.false
      expect(Extensions.args.database.description).to.equal('database to run command against')
    })

    it('should have optional remote flag', function () {
      expect(Extensions.flags.remote).to.exist
    })

    it('should contain essential plan query', function () {
      const config = new Config({root: process.cwd()})
      const command = new Extensions([], config)
      const {essentialPlanQuery} = command as unknown as Record<string, unknown>

      expect(essentialPlanQuery).to.include('SELECT *')
      expect(essentialPlanQuery).to.include('FROM pg_available_extensions')
      expect(essentialPlanQuery).to.include('rds.allowed_extensions')
    })

    it('should contain standard plan query', function () {
      const config = new Config({root: process.cwd()})
      const command = new Extensions([], config)
      const {standardPlanQuery} = command as unknown as Record<string, unknown>

      expect(standardPlanQuery).to.include('SELECT *')
      expect(standardPlanQuery).to.include('FROM pg_available_extensions')
      expect(standardPlanQuery).to.include('extwlist.extensions')
    })
  })

  describe('Command Instance', function () {
    it('should create instance with correct properties', function () {
      const config = new Config({root: process.cwd()})
      const command = new Extensions([], config)

      expect(command).to.be.instanceOf(Extensions)
      expect(command).to.have.property('essentialPlanQuery')
      expect(command).to.have.property('standardPlanQuery')
      expect(command).to.have.property('run')
      expect(typeof command.run).to.equal('function')
    })
  })
})
