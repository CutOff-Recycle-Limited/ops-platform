/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Mulish', 'system-ui', 'sans-serif'],
      },
      colors: {
        cr: {
          green: '#50ad32',
          'green-dark': '#459a2a',
          'green-light': '#e8f5e3',
          black: '#1a1a1a',
          navy: '#1f4074',
        },
      },
    },
  },
  plugins: [],
};
