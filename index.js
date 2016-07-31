'use strict'

const _ = require('lodash')

exports.commands = _.flatten([
  require('./commands/total_index_size')
])
