import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-vite'

const src = (entry: string) => fileURLToPath(new URL(`../../../packages/layout/src/${entry}/index.ts`, import.meta.url))

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  // 라이브러리 소스를 직접 불러와 수정 즉시 반영한다. React는 한 벌만 쓴다.
  viteFinal: async (vite) => ({
    ...vite,
    resolve: {
      ...vite.resolve,
      dedupe: ['react', 'react-dom'],
      alias: {
        ...(vite.resolve?.alias as Record<string, string> | undefined),
        '@justwonder/layout/side-panels': src('side-panels'),
        '@justwonder/layout/tiling': src('tiling'),
        '@justwonder/layout/grid': src('grid'),
      },
    },
  }),
}

export default config
