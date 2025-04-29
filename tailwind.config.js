/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'nba-primary': '#008348', // Green for NBA
        'nhl-primary': '#0033a0', // Blue for NHL
        'mlb-primary': '#bf0d3e', // Red for MLB
      },
    },
    safelist: [
      'bg-green-50', 'bg-green-100', 'bg-green-200', 'bg-green-600', 'bg-green-700',
      'text-green-700', 'text-green-800', 'border-green-200',
      'bg-blue-50', 'bg-blue-100', 'bg-blue-200', 'bg-blue-600', 'bg-blue-700',
      'text-blue-700', 'text-blue-800', 'border-blue-200',
      'bg-red-50', 'bg-red-100', 'bg-red-200', 'bg-red-600', 'bg-red-700',
      'text-red-700', 'text-red-800', 'border-red-200',
    ]
  },
  plugins: [],
}
