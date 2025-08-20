import {expect} from 'chai'

import * as util from '../../src/lib/util'

describe('util', function () {
  describe('Module Structure', function () {
    it('should export all required utility functions', function () {
      expect(util).to.have.property('ensurePGStatStatement')
      expect(util).to.have.property('ensureEssentialTierPlan')
      expect(util).to.have.property('essentialNumPlan')
      expect(util).to.have.property('newTotalExecTimeField')
      expect(util).to.have.property('newBlkTimeFields')
    })

    it('should have correct function signatures', function () {
      expect(typeof util.ensurePGStatStatement).to.equal('function')
      expect(typeof util.ensureEssentialTierPlan).to.equal('function')
      expect(typeof util.essentialNumPlan).to.equal('function')
      expect(typeof util.newTotalExecTimeField).to.equal('function')
      expect(typeof util.newBlkTimeFields).to.equal('function')
    })
  })

  describe('Integration Validation', function () {
    it('should be importable by command modules', function () {
      // This test validates that the module can be imported and used
      // The actual functionality is tested through the commands that use these utilities
      expect(util).to.be.an('object')
      expect(Object.keys(util)).to.have.length(5)
    })
  })
})
