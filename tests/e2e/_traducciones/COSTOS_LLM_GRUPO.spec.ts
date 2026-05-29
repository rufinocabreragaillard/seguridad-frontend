import { correrTestTraduccion } from './_template'

correrTestTraduccion({
  codigo: 'COSTOS_LLM_GRUPO',
  url: '/llm-group-costs',
  usuario: 'rufino@rufinocabrera.cl',
  password: 'Test1234!',
  locale: 'en',
  esMantenedor: false,
  permiteUpdate: false,
  permiteDelete: false,
})
