import rootConfig from '../../eslint.config.js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Inherit all root config
  ...rootConfig,

  // Node/server-specific rules
  {
    files: ['**/*.ts'],
    rules: {
      // Allow console in server code (needed for logging)
      'no-console': 'off',

      // Server-specific strictness
      '@typescript-eslint/no-require-imports': 'error',
      'no-process-exit': 'off',
    },
  },
);
