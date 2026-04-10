import globals from 'globals';
import pluginJs from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**'] },
  {
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  },
  {
    files: ['tests/**/*.ts', 'jest.setup.ts', 'jest.config.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.jest.json',
      },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/eol-last': 'error',
      '@stylistic/indent': ['error', 2],
      '@stylistic/linebreak-style': ['error', 'unix'],
      '@stylistic/max-len': ['error', {
        code: 80,
        ignoreComments: true,
        ignoreTemplateLiterals: true,
      }],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/semi': 'error',
      'sort-imports': ['error', { ignoreDeclarationSort: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];
