import animate from 'tailwindcss-animate'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'] },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        border: 'hsl(var(--border))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: '#fff', soft: 'hsl(var(--primary-soft))' },
        accent: { DEFAULT: 'hsl(var(--accent))', soft: 'hsl(var(--accent-soft))' },
        good: { DEFAULT: 'hsl(var(--good))', soft: 'hsl(var(--good-soft))' },
        warn: { DEFAULT: 'hsl(var(--warn))', soft: 'hsl(var(--warn-soft))' },
      },
      borderRadius: { xl: '0.9rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      boxShadow: {
        card: '0 1px 2px rgba(24,16,48,.04), 0 8px 24px -12px rgba(24,16,48,.10)',
        lift: '0 2px 4px rgba(24,16,48,.05), 0 18px 40px -16px rgba(76,29,149,.25)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up .35s cubic-bezier(.2,.7,.2,1) both' },
    },
  },
  plugins: [animate],
}
