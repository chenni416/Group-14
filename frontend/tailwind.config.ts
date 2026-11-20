import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '"Noto Sans TC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: '#F4F5F7',
        ink: '#111827',
        accent: {
          orange: '#F97316',
          sky: '#0EA5E9',
          violet: '#8B5CF6',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(17 24 39 / 0.04)',
        pop: '0 8px 24px -8px rgb(17 24 39 / 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config;
