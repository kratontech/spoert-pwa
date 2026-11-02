/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        turf: { 50: '#f1f8f2', 100: '#dcefdf', 200: '#b9dfc1', 500: '#2f8f4e', 600: '#1f7a3e', 700: '#17632f', 800: '#124d27', 900: '#0f3a1f' },
        chalk: '#f4f7f2',
      },
    },
  },
  plugins: [],
}
