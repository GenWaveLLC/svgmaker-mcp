module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'no-useless-catch': 'warn',
  },
  env: {
    node: true,
  },
  ignorePatterns: ['build', 'node_modules', '*.js'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  }
};
