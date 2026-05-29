import { correrTestTraduccion } from './_template'

correrTestTraduccion({
  codigo: 'TRADUCCIONES',
  url: '/translations',
  usuario: 'rufinocabreragaillard@gmail.com',
  password: 'Test1234!',
  locale: 'en',
  esMantenedor: true,
  permiteUpdate: true,
  permiteDelete: false,
})
