// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['next', 'next/*'], message: 'next is web-only. Use expo-router instead.' },
            { group: ['react-dom', 'react-dom/*'], message: 'react-dom is web-only.' },
            { group: ['@supabase/ssr'], message: '@supabase/ssr is web-only. Use @supabase/supabase-js directly.' },
          ],
        },
      ],
    },
  },
]);
