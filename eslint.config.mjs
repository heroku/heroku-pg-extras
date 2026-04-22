import oclif from 'eslint-config-oclif'

export default [
  ...oclif,
  {
    ignores: [
      './dist',
      './lib',
      '**/*.js',
      'workflows-repo/**/*',
    ],
  },
  {
    files: [
      '**/*.ts',
    ],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          modules: true,
        },
        ecmaVersion: 6,
        sourceType: 'module',
      },
    },
    rules: {
      '@stylistic/comma-dangle': 'warn',
      '@stylistic/indent': 'warn',
      '@stylistic/lines-between-class-members': 'warn',
      '@stylistic/object-curly-spacing': 'warn',
      '@stylistic/quotes': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'arrow-body-style': 'warn',
      camelcase: 'off',
      'import/namespace': 'warn',
      'mocha/no-mocha-arrows': 'warn',
      'n/no-missing-require': 'warn',
      'n/shebang': 'warn',
      'node/no-missing-import': 'off',
      'object-shorthand': 'warn',
      'perfectionist/sort-imports': 'warn',
      'perfectionist/sort-object-types': 'warn',
      'perfectionist/sort-objects': 'warn',
      'prefer-arrow-callback': 'warn',
      'unicorn/no-anonymous-default-export': 'warn',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-useless-undefined': 'warn',
      'unicorn/prefer-node-protocol': 'warn',
      'unicorn/prefer-number-properties': 'warn',
      'unicorn/prefer-regexp-test': 'warn',
    },
  },
]
