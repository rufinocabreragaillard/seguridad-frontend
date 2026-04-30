/**
 * Configuración de tema visual del sistema.
 * Modifica este archivo para adaptar la marca a cada cliente.
 */
export const tema = {
  app: {
    nombre: 'Server LM',
    nombreCorto: 'Server LM',
    version: '1.0.0',
  },
  logo: {
    // Fallback estático para el primer render (login, pre-auth). En runtime el
    // sidebar y demás superficies post-auth usan parametros_*.APARIENCIA/LOGO
    // (ver theme_engine.resolver_tema). Se mantiene alineado con el default
    // global de parametros_generales para evitar discrepancias visuales.
    url: '/serverlm_isotipo.png',
    alt: 'Server LM',
    ancho: 60,
    alto: 60,
  },
  // Los colores de Tailwind se configuran en globals.css bajo @theme
  // Referencia para uso en estilos inline si fuera necesario:
  colores: {
    primario: '#074B91',
    primarioHover: '#053870',
    primarioLight: '#1E5A9C',
    secundario: '#7C669F',
    acento: '#BF85B1',
    sidebar: '#074B91',
    sidebarActivo: '#1E5A9C',
  },
}
