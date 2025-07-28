'use strict'

const cli = require('heroku-cli-util')
cli.raiseErrors = true
global.commands = require('../index').commands

process.env.TZ = 'UTC'
process.stdout.columns = 120
process.stderr.columns = 120
