import { EMPTY_STATS } from '../config/constants.js'

export const CONFIG = {
  portal: { nombre: 'AGROCULTURA', avisar_rechazo: false, datos_de_ejemplo: true },
  sectores: [
    { id: 'minca', nombre: 'Minca', centro: { lat: 11.14, lon: -74.118 } },
    { id: 'la-tagua', nombre: 'La Tagua', centro: { lat: 11.13, lon: -74.087 } },
    { id: 'san-lorenzo', nombre: 'San Lorenzo', centro: { lat: 11.1245, lon: -74.154 } },
    { id: 'tijereras', nombre: 'Tijereras', centro: { lat: 11.109, lon: -74.111 } },
  ],
  etiquetas: ['#café', '#finca', '#familia', '#cosecha', '#cocina', '#oficios'],
  epocas: ['Antes de 1960', '1960 a 1979', '1980 a 1999', '2000 en adelante'],
  motivos_rechazo: [
    { id: 'fuera-del-tema', etiqueta: 'Fuera del tema', texto: 'Fuera del tema: no trata de la cultura cafetera' },
  ],
}

export const STATS = { ...EMPTY_STATS }
