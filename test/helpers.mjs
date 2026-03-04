import nock from 'nock'

const tm = globalThis.setTimeout
globalThis.setTimeout = cb => tm(cb)

process.env.TZ = 'UTC'
process.stdout.columns = 120 // Set screen width for consistent wrapping
process.stderr.columns = 120 // Set screen width for consistent wrapping

nock.disableNetConnect()
