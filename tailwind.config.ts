import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],

  theme: {
    extend: {
      colors: {
        // Black & White Theme
        background: '#FFFFFF',
        foreground: '#000000',

        primary: {
          DEFAULT: '#000000',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#FFFFFF',
          foreground: '#000000',
        },

        muted: {
          DEFAULT: '#F5F5F5',
          foreground: '#737373',
        },

        accent: {
          DEFAULT: '#E5E5E5',
          foreground: '#000000',
        },

        border: '#000000',
        ring: '#000000',

        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
      },

      fontFamily: {
        sans: ['Noto Sans KR', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'display-xl': ['6rem', { lineHeight: '1', fontWeight: '700' }],
        'display-lg': ['4.5rem', { lineHeight: '1', fontWeight: '700' }],
        'display-md': ['3rem', { lineHeight: '1.2', fontWeight: '700' }],
      },

      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'countdown': 'countdown 1s ease-in-out',
        'flash': 'flash 0.2s ease-in-out',
      },

      keyframes: {
        countdown: {
          '0%': { transform: 'scale(1.5)', opacity: '0' },
          '50%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.9)', opacity: '1' },
        },
        flash: {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
