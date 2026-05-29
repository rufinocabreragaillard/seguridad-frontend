import { correrTestTraduccion } from './_template'

correrTestTraduccion({
  codigo: 'GEST_USUARIOS',
  url: '/users',
  usuario: 'rufino@rufinocabrera.cl',
  password: 'Test1234!',
  locale: 'en',
  esMantenedor: true,
  permiteUpdate: true,
  permiteDelete: false,
})
