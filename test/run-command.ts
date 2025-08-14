const {Command: CommandClass} = require('@heroku-cli/command')
const {Config: ConfigClass} = require('@oclif/core')
const {resolve} = require('node:path')
const {stderr, stdout} = require('stdout-stderr')

type CmdConstructorParams = ConstructorParameters<typeof CommandClass>
type GenericCmd = new (...args: CmdConstructorParams) => typeof CommandClass

const stopMock = () => {
  stdout.stop()
  stderr.stop()
}

const getConfig = async () => {
  const conf = new ConfigClass({root: resolve(__dirname, '../package.json')})
  await conf.load()
  return conf
}

const runCommandHelper = async (Cmd: GenericCmd, args: string[] = [], printStd = false) => {
  const conf = await getConfig()
  const instance = new Cmd(args, conf)
  if (printStd) {
    stdout.print = true
    stderr.print = true
  } else {
    stdout.print = false
    stderr.print = false
  }

  stdout.start()
  stderr.start()

  return instance
    .run()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then((result: any) => {
      stopMock()
      return result
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .catch((error: any) => {
      stopMock()
      throw error
    })
}

module.exports = {runCommand: runCommandHelper}
