'use strict'

const _ = require('lodash')
const path = require('path')
const fs = require('fs')

let dir = path.join(__dirname, 'commands')

exports.commands = _.chain(fs.readdirSync(dir))
.filter(f => path.extname(f) === '.js')
.map(f => require('./commands/' + f))
.flatten()
.value()
