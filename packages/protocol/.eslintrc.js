const DISABLED = 0
const WARN = 1
const ERROR = 2

module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'plugin:promise/recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': DISABLED,
  }
}