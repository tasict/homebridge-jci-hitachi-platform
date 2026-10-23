import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    linterOptions: {
      // Same as the old .eslintrc: no rules are enabled, so the existing
      // eslint-disable comments would otherwise be reported as unused.
      reportUnusedDisableDirectives: 'off',
    },
  },
];
