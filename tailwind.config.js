/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: '#0d0f0c',
        panel: '#161812',
        'panel-2': '#1e2118',
        line: '#2c2f24',
        primary: {
          DEFAULT: '#f5a623',
          press: '#d98f12',
        },
        gain: '#ffc53d',
        loss: '#e5484d',
        ink: {
          DEFAULT: '#ecead9',
          muted: '#8a8d7a',
        },
      },
      fontFamily: {
        display: ['Oswald', '"Noto Sans SC"', 'sans-serif'],
        body: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
