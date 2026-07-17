/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Gold, tuned to the RR Groups crest (rich metallic gold on navy)
        brand: {
          50: '#fdf8ec',
          100: '#faedc4',
          200: '#f3da88',
          300: '#eac765',
          400: '#dcaa3c',
          500: '#c3901f',
          600: '#a87615',
          700: '#8a5f13',
          800: '#6b4a12',
          900: '#4a3306',
          950: '#2e1f04',
        },
        // Navy, tuned to the RR Groups crest background
        ink: {
          50: '#f7f8fb',
          100: '#eef0f6',
          200: '#dbe0eb',
          300: '#b6bfd6',
          400: '#8891b3',
          500: '#5f6890',
          600: '#454e70',
          700: '#2f3654',
          800: '#1a2038',
          900: '#0d1226',
          950: '#050813',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.05)',
        'card-hover': '0 10px 30px -8px rgb(168 118 21 / 0.18), 0 4px 10px -6px rgb(15 23 42 / 0.08)',
        soft: '0 2px 12px -2px rgb(15 23 42 / 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slideInLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: 0, transform: 'translateX(20px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: 0, transform: 'translateX(40px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: 0, transform: 'scale(0.96)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
