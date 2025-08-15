import {Command} from '@heroku-cli/command'
import {Config} from '@oclif/core'
import {stderr, stdout} from 'stdout-stderr'

type CmdConstructorParams = ConstructorParameters<typeof Command>
export type GenericCmd = new (..._args: CmdConstructorParams) => Command

const stopMock = () => {
  stdout.stop()
  stderr.stop()
}

const getConfig = async () => {
  const pjsonPath = require.resolve('../package.json')
  const conf = new Config({root: pjsonPath})
  await conf.load()
  return conf
}

export const runCommand = async (Cmd: GenericCmd, args: string[] = [], printStd = false) => {
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
    .then(args => {
      stopMock()
      return args
    })
    .catch(error => {
      stopMock()
      throw error
    })
}
