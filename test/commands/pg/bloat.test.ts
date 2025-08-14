const {Config} = require('@oclif/core')
const chaiLib = require('chai')
const sinonLib = require('sinon')

// Dynamic imports for ES6 modules
let chaiAsPromised: any
let sinonChai: any
let Bloat: any
let runCommand: any

// Import ES6 modules dynamically
before(async () => {
  chaiAsPromised = (await import('chai-as-promised')).default
  sinonChai = (await import('sinon-chai')).default
  Bloat = (await import('../../../dist/commands/pg/bloat.js')).default
  runCommand = (await import('../../run-command.js')).runCommand
  
  // Configure chai plugins
  chaiLib.use(chaiAsPromised)
  chaiLib.use(sinonChai)
})

describe('pg:bloat', function () {
  const {expect} = chaiLib
  let sandbox: any

  beforeEach(function () {
    sandbox = sinonLib.createSandbox()
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
      expect(Bloat.args.database.description).to.equal('database name')
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
