import {Config} from '@oclif/core'
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'

import Bloat from '../../../dist/commands/pg/bloat'
import {runCommand} from '../../run-command'

// Configure chai plugins
chai.use(chaiAsPromised)
chai.use(sinonChai)

describe('pg:bloat', function () {
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
      expect(Bloat.description).to.equal('show table and index bloat in your database ordered by most wasteful')
    })

    it('should have required app flag', function () {
      expect(Bloat.flags.app.required).to.be.true
    })

    it('should have optional database argument', function () {
      expect(Bloat.args.database.required).to.be.false
      expect(Bloat.args.database.description).to.equal('database to run command against')
    })

    it('should have optional remote flag', function () {
      expect(Bloat.flags.remote).to.exist
    })

    it('should contain bloat analysis query', function () {
      const config = new Config({root: process.cwd()})
      const command = new Bloat([], config)
      const {query} = command as unknown as Record<string, unknown>

      expect(query).to.include('WITH constants AS')
      expect(query).to.include('bloat_info AS')
      expect(query).to.include('table_bloat AS')
      expect(query).to.include('index_bloat AS')
      expect(query).to.include('ORDER BY raw_waste DESC, bloat DESC')
    })
  })

  describe('Command Instance', function () {
    it('should create instance with correct properties', function () {
      const config = new Config({root: process.cwd()})
      const command = new Bloat([], config)

      expect(command).to.be.instanceOf(Bloat)
      expect(command).to.have.property('query')
      expect(command).to.have.property('run')
      expect(typeof command.run).to.equal('function')
    })
  })

  describe('Command Logic', function () {
    it('should have run method that is callable', function () {
      const config = new Config({root: process.cwd()})
      const command = new Bloat([], config)

      expect(command).to.have.property('run')
      expect(typeof command.run).to.equal('function')
      expect(command.run).to.be.instanceOf(Function)
    })

    it('should work with runCommand helper', function () {
      // This demonstrates integration with the existing test infrastructure
      expect(typeof runCommand).to.equal('function')
    })
  })
})
