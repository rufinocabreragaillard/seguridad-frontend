/**
 * Configuración de tema visual del sistema.
 * Modifica este archivo para adaptar la marca a cada cliente.
 */
export const tema = {
  app: {
    nombre: 'ServerLM',
    nombreCorto: 'SeguridadApp',
    version: '1.0.0',
  },
  logo: {
    url: '/logo_A_bn.png',
    alt: 'Logo',
    ancho: 110,
    alto: 36,
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
