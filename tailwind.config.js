/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b', // Plomo claro
          600: '#475569', // Plomo medio (con Integridad)
          700: '#334155', // Plomo oscuro
          800: '#1e293b', // Textos oscuros
          900: '#0f172a', // Matte Black (Consultar / Barra)
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'], // Tipografía limpia y moderna
      }
    },
  },
  plugins: [],
}
