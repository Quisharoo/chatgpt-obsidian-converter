const { fontFamily } = require('tailwindcss/defaultTheme');

module.exports = {
  darkMode: ['class'],
  content: ['index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1280px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(222.2 47.4% 11.2%)',
        input: 'hsl(216 34% 17%)',
        ring: 'hsl(224.3 76.3% 48%)',
        background: 'hsl(222.2 47.4% 11.2%)',
        foreground: 'hsl(213 31% 91%)',
        card: {
          DEFAULT: 'hsl(217 33% 16%)',
          foreground: 'hsl(213 31% 91%)'
        },
        popover: {
          DEFAULT: 'hsl(222 37% 12%)',
          foreground: 'hsl(213 31% 91%)'
        },
        primary: {
          DEFAULT: 'hsl(245 90% 67%)',
          foreground: 'hsl(214 32% 99%)'
        },
        secondary: {
          DEFAULT: 'hsl(217 33% 24%)',
          foreground: 'hsl(214 32% 96%)'
        },
        muted: {
          DEFAULT: 'hsl(215 28% 15%)',
          foreground: 'hsl(215 20% 65%)'
        },
        accent: {
          DEFAULT: 'hsl(242 84% 65%)',
          foreground: 'hsl(214 32% 96%)'
        },
        destructive: {
          DEFAULT: 'hsl(0 63% 47%)',
          foreground: 'hsl(354 60% 96%)'
        },
        success: {
          DEFAULT: 'hsl(142 70% 45%)',
          foreground: 'hsl(142 82% 15%)'
        }
      },
      borderRadius: {
        lg: '0.75rem',
        md: 'calc(0.75rem - 2px)',
        sm: 'calc(0.75rem - 4px)'
      },
      fontFamily: {
        sans: ['Inter', ...fontFamily.sans]
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
