/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}'
  ],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        core: {
          background: '#F7F4EF',
          surface: '#EFEAE2',
          'surface-elevated': '#E8E2D9',
          'text-primary': '#1A1714',
          'text-secondary': '#6B6560',
          'text-disabled': '#B0AAA3'
        },
        brand: {
          ember: '#E8612A',
          'ember-mist': '#FDF0EA',
          flax: '#C9A84C',
          sage: '#6A8F7A'
        },
        semantic: {
          danger: '#D94F3D',
          warning: '#E0A030',
          success: '#4A8C68',
          info: '#4A7FA5',
          border: '#DDD8D0'
        }
      },
      boxShadow: {
        card: '0 8px 24px rgba(26,23,20,0.07)',
        'mic-glow': '0 0 20px rgba(232,97,42,0.4)'
      },
      fontFamily: {
        heading: ["DMSerifDisplay"],
        text: ["InstrumentSans"]
      }
    },
  },
  plugins: [],
};
