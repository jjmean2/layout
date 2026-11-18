// ESLint flat config.
// TypeScript 7에는 typescript-eslint가 쓰는 JS API가 없어서, TS 문법은 Babel parser로 읽는다.
// 따라서 타입 정보를 쓰는 규칙은 없고, 타입 검사는 `tsc`가 맡는다.
import babelParser from '@babel/eslint-parser'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/storybook-static/**',
      '**/node_modules/**',
      '**/test-results/**',
      '**/next-env.d.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          babelrc: false,
          configFile: false,
          // 파싱만 한다 (변환 없음). TS와 JSX 문법을 parser 플러그인으로 켠다.
          parserOpts: { plugins: ['typescript', 'jsx'] },
        },
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
]
