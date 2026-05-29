import { correrTestTraduccion } from './_template'

correrTestTraduccion({
  codigo: 'CHAT-USUARIO',
  url: '/chat',
  usuario: 'rufino@rufinocabrera.cl',
  password: 'Test1234!',
  locale: 'en',
  esMantenedor: false,
})
