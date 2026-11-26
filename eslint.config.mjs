import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      '.next/**',
      '.netlify/**',
      '.vercel/**',
      'node_modules/**',
      'drizzle/**',
      'playwright-report/**',
      'test-results/**',
      'tailwind.config.js',
      'postcss.config.js',
    ],
  },
];

export default eslintConfig;
