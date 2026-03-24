import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primario: {
          DEFAULT: '#074B91',
          hover:   '#053870',
          light:   '#1E5A9C',
          'muy-claro': '#E8EFF8',
        },
        secundario: {
          DEFAULT: '#7C669F',
          light:   '#9B82B8',
          'muy-claro': '#EDE8F5',
        },
        acento: {
          DEFAULT: '#BF85B1',
          light:   '#D4A8CA',
          'muy-claro': '#F5ECF3',
        },
        sidebar: {
          DEFAULT:      '#053870',
          activo:       '#1E5A9C',
          hover:        '#0A4A8A',
          texto:        '#FFFFFF',
          'texto-muted':'#B8C8DE',
        },
        fondo:   '#F4F5F8',
        surface: '#FFFFFF',
        borde:   '#E2E4EC',
        texto: {
          DEFAULT: '#1A1E2E',
          muted:   '#6B7280',
          light:   '#9CA3AF',
        },
        exito:      '#16A34A',
        error:      '#DC2626',
        advertencia:'#D97706',
      },
    },
  },
  plugins: [],
}

export default config
