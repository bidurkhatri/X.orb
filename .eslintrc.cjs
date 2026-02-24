/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
    jest: true,
    cypress: true
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:security/recommended',
    'plugin:sonarjs/recommended',
    'plugin:unicorn/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'import',
    'security',
    'sonarjs',
    'unicorn',
    'jsdoc',
    'promise',
    'better-styled-components',
    'react-native',
    'react-native-a11y'
  ],
  settings: {
    react: {
      version: 'detect'
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json'
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      }
    }
  },
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/prefer-readonly-parameter-types': 'off',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'error',
    '@typescript-eslint/prefer-enum-initializers': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/prefer-reduce-type-parameter': 'error',
    '@typescript-eslint/prefer-return-this-type': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/unified-signatures': 'error',
    
    // Security rules
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    
    // React specific rules
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/display-name': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    'react/no-unescaped-entities': 'error',
    'react/jsx-key': 'error',
    'react/jsx-no-duplicate-props': 'error',
    'react/jsx-no-undef': 'error',
    'react/jsx-uses-react': 'off',
    'react/jsx-uses-vars': 'error',
    'react/no-children-prop': 'error',
    'react/no-danger': 'warn',
    'react/no-deprecated': 'error',
    'react/no-direct-mutation-state': 'error',
    'react/no-unknown-property': 'error',
    'react/require-render-return': 'error',
    
    // Import rules
    'import/no-duplicates': 'error',
    'import/order': ['error', {
      groups: [
        'builtin',
        'external',
        'internal',
        ['parent', 'sibling'],
        'index'
      ],
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true
      }
    }],
    'import/newline-after-import': 'error',
    'import/no-self-import': 'error',
    'import/no-cycle': ['error', { maxDepth: 10 }],
    'import/no-useless-path-segments': 'error',
    'import/export': 'error',
    'import/no-mutable-exports': 'error',
    
    // General code quality rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-void': 'error',
    
    // Array and object rules
    'array-callback-return': 'error',
    'consistent-return': 'error',
    'no-iterator': 'error',
    'no-sparse-arrays': 'error',
    'prefer-spread': 'error',
    
    // Best practices
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    'curly': 'error',
    'no-caller': 'error',
    'no-else-return': 'error',
    'no-empty-function': ['error', { 
      allow: ['arrowFunctions', 'functions', 'methods'] 
    }],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-magic-numbers': ['warn', { 
      ignore: [0, 1, -1, 100, 1000],
      ignoreArrayIndexes: true,
      enforceConst: true,
      detectObjects: false 
    }],
    'no-param-reassign': ['error', { 
      props: false 
    }],
    'no-return-assign': 'error',
    'no-throw-literal': 'error',
    'no-unneeded-ternary': 'error',
    'no-useless-return': 'error',
    'prefer-template': 'error',
    'spaced-comment': ['error', 'always', { 
      exceptions: ['-', '+'], 
      markers: ['/'] 
    }],
    
    // JSDoc rules
    'jsdoc/require-jsdoc': ['error', {
      publicOnly: true,
      requireReturn: false,
      requireParamDescription: true,
      requireReturnDescription: true,
      matchDescription: '.{10,}'
    }],
    'jsdoc/require-param': 'error',
    'jsdoc/require-param-description': 'error',
    'jsdoc/require-param-type': 'error',
    'jsdoc/require-returns': 'error',
    'jsdoc/require-returns-description': 'error',
    'jsdoc/require-returns-type': 'error',
    'jsdoc/valid-types': 'error',
    'jsdoc/no-undefined-types': 'error',
    'jsdoc/no-types': 'error',
    'jsdoc/require-hyphen-before-param-description': 'error',
    'jsdoc/check-tag-names': 'error',
    'jsdoc/check-param-names': 'error',
    'jsdoc/check-property-names': 'error',
    'jsdoc/require-property': 'error',
    'jsdoc/require-property-description': 'error',
    'jsdoc/require-property-type': 'error',
    'jsdoc/require-asterisk-prefix': 'error',
    'jsdoc/check-types': 'error',
    'jsdoc/check-access': 'error',
    'jsdoc/empty-tags': 'error',
    'jsdoc/implements-on-classes': 'error',
    'jsdoc/no-bad-blocks': 'error',
    'jsdoc/multiline-blocks': 'error',
    'jsdoc/require-file-overview': 'off',
    'jsdoc/newline-after-description': 'error',
    'jsdoc/no-multi-asterisks': 'error',
    'jsdoc/require-constructor': 'error',
    'jsdoc/require-description-complete-sentence': 'error',
    'jsdoc/check-line-alignment': 'error',
    'jsdoc/require-throws': 'error',
    'jsdoc/require-yields': 'error',
    'jsdoc/require-yields-check': 'error',
    
    // Promise rules
    'promise/always-return': 'error',
    'promise/no-return-wrap': 'error',
    'promise/param-names': 'error',
    'promise/catch-or-return': 'error',
    'promise/no-native': 'off',
    'promise/no-nesting': 'warn',
    'promise/no-promise-in-callback': 'error',
    'promise/no-callback-in-promise': 'error',
    'promise/avoid-new': 'warn',
    'promise/no-return-in-finally': 'error',
    'promise/valid-params': 'error',
    'promise/prefer-await-to-then': 'error',
    'promise/prefer-await-to-callbacks': 'error',
    
    // SonarJS rules
    'sonarjs/cognitive-complexity': ['error', 15],
    'sonarjs/no-duplicate-string': 'error',
    'sonarjs/no-identical-functions': 'error',
    'sonarjs/no-identical-literals': 'error',
    'sonarjs/no-inverted-boolean-check': 'error',
    'sonarjs/no-redundant-boolean': 'error',
    'sonarjs/no-same-argument-assert': 'error',
    'sonarjs/no-same-line-conditional': 'error',
    'sonarjs/no-unused-collection-element': 'error',
    'sonarjs/no-useless-catch': 'error',
    'sonarjs/prefer-immediate-return': 'error',
    'sonarjs/prefer-object-literal': 'error',
    'sonarjs/prefer-single-boolean-return': 'error',
    'sonarjs/toggle-all-expressions': 'error',
    'sonarjs/unused-named-groups': 'error',
    'sonarjs/use-isnan': 'error',
    
    // Unicorn rules
    'unicorn/catch-error-name': 'error',
    'unicorn/consistent-destructuring': 'error',
    'unicorn/consistent-empty-array-spread': 'error',
    'unicorn/consistent-function-scoping': 'error',
    'unicorn/custom-error-definition': 'error',
    'unicorn/empty-brace-spaces': 'error',
    'unicorn/error-message': 'error',
    'unicorn/escape-case': 'error',
    'unicorn/explicit-length-check': 'error',
    'unicorn/filename-case': ['error', { 
      case: 'kebabCase' 
    }],
    'unicorn/import-index': 'error',
    'unicorn/import-style': 'error',
    'unicorn/new-for-builtins': 'error',
    'unicorn/no-array-instanceof': 'error',
    'unicorn/no-array-push-push': 'error',
    'unicorn/no-await-expression-member': 'error',
    'unicorn/no-console-spaces': 'error',
    'unicorn/no-empty-file': 'error',
    'unicorn/no-for-loop': 'error',
    'unicorn/no-hex-escape': 'error',
    'unicorn/no-instanceof-array': 'error',
    'unicorn/no-lonely-if': 'error',
    'unicorn/no-nested-ternary': 'error',
    'unicorn/no-new-array': 'error',
    'unicorn/no-new-buffer': 'error',
    'unicorn/no-object-as-default-parameter': 'error',
    'unicorn/no-process-env': 'error',
    'unicorn/no-static-only-class': 'error',
    'unicorn/no-thenable': 'error',
    'unicorn/no-unnecessary-polyfills': 'error',
    'unicorn/no-unnecessary-type-assertion': 'error',
    'unicorn/no-unused-properties': 'error',
    'unicorn/no-useless-fallback-in-spread': 'error',
    'unicorn/no-useless-length-check': 'error',
    'unicorn/no-useless-promise-resolve-reject': 'error',
    'unicorn/no-useless-spread': 'error',
    'unicorn/no-zero-decimals': 'error',
    'unicorn/number-literal-case': 'error',
    'unicorn/numeric-separators-style': 'error',
    'unicorn/optional-chaining-assignment': 'error',
    'unicorn/prefer-add-event-listener': 'error',
    'unicorn/prefer-array-find': 'error',
    'unicorn/prefer-array-flat': 'error',
    'unicorn/prefer-array-flat-map': 'error',
    'unicorn/prefer-array-from': 'error',
    'unicorn/prefer-array-index-of': 'error',
    'unicorn/prefer-array-some': 'error',
    'unicorn/prefer-astral-code': 'error',
    'unicorn/prefer-at': 'error',
    'unicorn/prefer-blob-reading-methods': 'error',
    'unicorn/prefer-code-point': 'error',
    'unicorn/prefer-conditional-expression': 'error',
    'unicorn/prefer-date-now': 'error',
    'unicorn/prefer-default-parameters': 'error',
    'unicorn/prefer-destructuring': 'error',
    'unicorn/prefer-event-target': 'error',
    'unicorn/prefer-exponentiation-operator': 'error',
    'unicorn/prefer-export-from': 'error',
    'unicorn/prefer-flat-map': 'error',
    'unicorn/prefer-includes': 'error',
    'unicorn/prefer-jest-dom': 'error',
    'unicorn/prefer-keyboard-event-key': 'error',
    'unicorn/prefer-math-trim': 'error',
    'unicorn/prefer-modern-dom-apis': 'error',
    'unicorn/prefer-module': 'error',
    'unicorn/prefer-native-coercion-functions': 'error',
    'unicorn/prefer-negative-index': 'error',
    'unicorn/prefer-node-append': 'error',
    'unicorn/prefer-node-remove': 'error',
    'unicorn/prefer-number-properties': 'error',
    'unicorn/prefer-object-from-entries': 'error',
    'unicorn/prefer-optional-catch-binding': 'error',
    'unicorn/prefer-prototype-methods': 'error',
    'unicorn/prefer-query-selector': 'error',
    'unicorn/prefer-reflect-apply': 'error',
    'unicorn/prefer-regular-expression': 'error',
    'unicorn/prefer-remove': 'error',
    'unicorn/prefer-set-has': 'error',
    'unicorn/prefer-spread': 'error',
    'unicorn/prefer-string-replace-all': 'error',
    'unicorn/prefer-string-slice': 'error',
    'unicorn/prefer-string-starts-ends-with': 'error',
    'unicorn/prefer-string-trim-start-end': 'error',
    'unicorn/prefer-type-error': 'error',
    'unicorn/prefer-unguarded-regexp-flag': 'error',
    'unicorn/prefer-unique-array': 'error',
    'unicorn/prefer-uses-node-protocol': 'error',
    'unicorn/prefer-uses-nodejs': 'error',
    'unicorn/require-array-join-separator': 'error',
    'unicorn/require-error-message-for-array': 'error',
    'unicorn/require-number-to-fixed-digits-argument': 'error',
    'unicorn/string-content': 'error',
    'unicorn/template-indent': 'error',
    'unicorn/throw-new-error': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.{js,ts,tsx}'],
      env: {
        jest: true
      },
      rules: {
        'no-magic-numbers': 'off',
        'sonarjs/no-duplicate-string': 'off'
      }
    },
    {
      files: ['**/*.spec.{js,ts,tsx}'],
      env: {
        jest: true
      },
      rules: {
        'no-magic-numbers': 'off',
        'sonarjs/no-duplicate-string': 'off'
      }
    },
    {
      files: ['**/*.cy.{js,ts,tsx}'],
      env: {
        'cypress/globals': true
      },
      plugins: ['cypress'],
      rules: {
        'cypress/no-unnecessary-waiting': 'error',
        'cypress/no-async-tests': 'error',
        'cypress/no-async-commands': 'error'
      }
    },
    {
      files: ['**/*.d.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'jsdoc/require-jsdoc': 'off'
      }
    }
  ]
};