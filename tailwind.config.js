/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        // -----------------------------------------------------------
        // Paleta corporativa Serfunorte (alineada con mantix-frontend)
        // Verde principal: #00875c
        // -----------------------------------------------------------
        primary: {
          50:  '#e6f7f1',
          100: '#b3e6d4',
          200: '#80d5b7',
          300: '#4dc49a',
          400: '#1ab37d',
          500: '#00875c',   // Color principal Serfunorte
          600: '#006d4a',
          700: '#005a3d',   // Color secundario
          800: '#004730',
          900: '#003423',
        },
        secondary: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },

        // -----------------------------------------------------------
        // Aliases semánticos heredados (clases sv-* siguen funcionando)
        // Los nombres no cambian para preservar todos los componentes,
        // pero los valores ahora son los de la paleta corporativa.
        // -----------------------------------------------------------
        cream:        '#f9fafb',   // fondo base claro (antes cálido cream)
        'brown-deep': '#004730',   // sidebars/nav oscuro (primary-800)
        'brown-warm': '#005a3d',   // acento oscuro (primary-700)
        gold:         '#00875c',   // CTA principal (primary-500)
        'gold-bright':'#1ab37d',   // hover CTA (primary-400)
        sage:         '#16a34a',   // éxito (secondary-600)
        danger:       '#dc2626',   // rojo estándar Tailwind
        warning:      '#f59e0b',   // ámbar estándar Tailwind
        text1:        '#111827',   // gris-900
        text2:        '#374151',   // gris-700
        text3:        '#6b7280',   // gris-500

        // Colores de identificación por área (se conservan para diferenciar
        // visualmente en AreaBadges, sidebars y tiles del SelectorArea)
        area: {
          prenec: '#00875c',   // verde Serfunorte (prenecesidad = principal)
          emp:    '#1d4ed8',   // azul (B2B / empresariales)
          pap:    '#15803d',   // verde campo (PAP — secondary-700)
          svc:    '#0f766e'    // teal-700 (servicio al cliente / call center)
        }
      },
      fontFamily: {
        // Corporativas SenoFlow / Serfunorte
        serif: ['"Comfortaa"', 'system-ui', 'sans-serif'],   // títulos, logo
        sans:  ['"Raleway"', 'system-ui', 'sans-serif'],     // body, formularios
        alt:   ['"Hind Vadodara"', 'system-ui', 'sans-serif'] // utility opcional: font-alt
      },
      boxShadow: {
        'sv-card': '0 1px 3px 0 rgb(44 26 14 / 0.06), 0 1px 2px -1px rgb(44 26 14 / 0.04)',
        'sv-pop':  '0 10px 25px -5px rgb(44 26 14 / 0.18), 0 8px 10px -6px rgb(44 26 14 / 0.10)'
      },
      borderRadius: {
        'sv': '10px'
      }
    }
  },
  plugins: [require('@tailwindcss/forms')]
};
