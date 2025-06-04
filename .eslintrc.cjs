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
    '@typescript-eslint/no-explicit-any': 'off', // Temporarily disabled
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
    'no-useless-catch': 'off', // Temporarily disabled
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
