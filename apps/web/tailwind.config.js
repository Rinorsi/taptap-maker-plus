/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['MiSans', 'Microsoft YaHei', 'PingFang SC', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: 'var(--color-brand)',
          strong: 'var(--color-brand-strong)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          soft: 'var(--color-border-soft)',
        },
        text: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          subtle: 'var(--color-text-subtle)',
        },
        surface: {
          app: 'var(--surface-app)',
          panel: 'var(--surface-panel)',
          raised: 'var(--surface-raised)',
          muted: 'var(--surface-muted)',
        },
        agent: {
          bg: 'var(--agent-bg)',
          panel: 'var(--agent-panel)',
          surface: 'var(--agent-surface)',
          border: 'var(--agent-border)',
          'border-soft': 'var(--agent-border-soft)',
          text: 'var(--agent-text)',
          muted: 'var(--agent-muted)',
          subtle: 'var(--agent-subtle)',
          accent: 'var(--agent-accent)',
          warning: 'var(--agent-warning)',
        }
      },
      borderRadius: {
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        panel: 'var(--radius-panel)',
        large: 'var(--radius-large)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        popover: 'var(--shadow-popover)',
      }
    },
  },
  plugins: [],
}
