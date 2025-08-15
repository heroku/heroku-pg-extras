module.exports = {
  require: ['ts-node/register/transpile-only'],
  extension: ['ts'],
  spec: 'test/**/*.test.ts',
  timeout: 10000,
  'node-option': [
    'experimental-specifier-resolution=node',
    'loader=ts-node/esm'
  ]
}
