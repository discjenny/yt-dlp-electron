/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './renderer/**/*.{ts,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0b0c10',
        panel: '#111217',
        fg: '#e6edf3',
        muted: '#9aa4b2',
        border: '#1a1b20',
        accent: '#5cd3a4',
      },
    },
  },
  plugins: [],
};
