/** @type {import('tailwindcss').Config} */
module.exports = {
  // Keep the paths specific to your Expo app
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}'
  ],
  presets: [
    require('@blisp/tailwind-config'), // Pull in your shared theme
    require('nativewind/preset')       // Keep NativeWind specifically for the mobile app
  ],
};