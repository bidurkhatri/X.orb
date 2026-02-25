/** @type {import('commitlint').Config} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Header rules
    'header-max-length': [2, 'always', 100],
    'header-min-length': [2, 'always', 10],
    'header-case': [2, 'always', 'sentence'],

    // Type rules
    'type-case': [2, 'always', 'lower-case'],
    'type-enum': [
      2,
      'always',
      [
        'feat',     // new feature
        'fix',      // bug fix
        'docs',     // documentation changes
        'style',    // formatting, missing semi colons, etc
        'refactor', // code restructuring without fixing bugs
        'perf',     // performance improvements
        'test',     // adding tests
        'build',    // build system changes
        'ci',       // CI configuration changes
        'chore',    // other changes that don't modify src or test files
        'revert',   // revert previous commit
        'quality'   // code quality improvements
      ]
    ],
    'type-empty': [2, 'never'],

    // Subject rules
    'subject-case': [2, 'always', 'sentence'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],

    // Body rules
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],
    'body-empty': [0, 'never'],

    // Footer rules
    'footer-leading-blank': [2, 'always'],
    'footer-max-line-length': [2, 'always', 100],

    // Scoping rules (optional but recommended for larger projects)
    'scope-case': [2, 'always', 'kebab-case'],
    'scope-empty': [2, 'never'],

    // Additional custom rules
    'references-empty': [2, 'never'],
    'signed-off-by': [2, 'always', 'Signed-off-by:'],
  },
  plugins: [
    {
      // Custom plugin for additional SylOS-specific rules
      rules: {
        'sylos/scope-enum': [
          2,
          'always',
          [
            'blockchain',
            'web-app',
            'mobile-app',
            'contracts',
            'testing',
            'docs',
            'deployment',
            'security',
            'performance',
            'build',
            'config',
            'scripts',
            'quality',
            'monitoring'
          ]
        ]
      }
    }
  ]
};