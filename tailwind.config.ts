import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#f8f9fc',
          100: '#eef0f6',
          200: '#d5d9e8',
          300: '#b3b9d1',
          400: '#8b93b5',
          500: '#6b739b',
          600: '#555c81',
          700: '#454b69',
          800: '#1e2033',
          900: '#15172a',
          950: '#0d0e1a',
        },
        accent: {
          DEFAULT: '#7c5cfc',
          light: '#a78bfa',
          dark: '#5b3fd9',
          glow: 'rgba(124, 92, 252, 0.15)',
        },
        success: '#34d399',
        warning: '#fbbf24',
        danger: '#f87171',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(124, 92, 252, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(124, 92, 252, 0.4)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
