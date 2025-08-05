module.exports = {
  env: {
    node: true,
  },
  extends: ['./node_modules/@heroku-cli/test-utils/dist/eslint-config.js'],
  overrides: [
    {
      files: ['src/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
}
