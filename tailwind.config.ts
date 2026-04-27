import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Arial', 'Helvetica', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        primario: {
          DEFAULT:     'var(--color-primario, #074B91)',
          texto:       'var(--color-primario-texto, #FFFFFF)',
          oscuro:      'var(--color-primario-oscuro, #074B91)',
          hover:       'var(--color-primario-hover, #053870)',
          light:       'var(--color-primario-light, #1E5A9C)',
          'muy-claro': 'var(--color-primario-muy-claro, #E8EFF8)',
        },
        secundario: {
          DEFAULT:     'var(--color-secundario, #7C669F)',
          light:       'var(--color-secundario-light, #9B82B8)',
          'muy-claro': 'var(--color-secundario-muy-claro, #EDE8F5)',
        },
        acento: {
          DEFAULT:     'var(--color-acento, #BF85B1)',
          light:       'var(--color-acento-light, #D4A8CA)',
          'muy-claro': 'var(--color-acento-muy-claro, #F5ECF3)',
        },
        sidebar: {
          DEFAULT:      'var(--color-sidebar, #074B91)',
          activo:       'var(--color-sidebar-activo, #1E5A9C)',
          hover:        'var(--color-sidebar-hover, #0A4A8A)',
          texto:        'var(--color-sidebar-texto, #FFFFFF)',
          'texto-muted':'var(--color-sidebar-texto-muted, #B8C8DE)',
        },
        fondo:       'var(--color-fondo, #F4F5F8)',
        surface:     'var(--color-surface, #FFFFFF)',
        borde:       'var(--color-borde, #E2E4EC)',
        texto: {
          DEFAULT:   'var(--color-texto, #1A1E2E)',
          muted:     'var(--color-texto-muted, #6B7280)',
          light:     'var(--color-texto-light, #9CA3AF)',
        },
        exito:       'var(--color-exito, #16A34A)',
        error:       'var(--color-error, #DC2626)',
        advertencia: 'var(--color-advertencia, #D97706)',
      },
    },
  },
  plugins: [],
}

export default config
