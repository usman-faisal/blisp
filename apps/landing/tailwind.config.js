/** @type {import('tailwindcss').Config} */
module.exports = {
  // Paths specific to your web app
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  presets: [
    require('@blisp/tailwind-config')
  ],
};