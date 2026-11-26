/**
 * A caption of a file says what it is and then its credit: «Canto del azulejo… en 2007. Grabación: …, CC BY-NC-SA 4.0.».
 * The player shows the first part as its title and the credit, smaller, under it.
 */
export function splitCaption(caption = '') {
  const text = String(caption).trim()
  const cut = text.search(/\. (Grabación|Foto|Video|Fuente):/)
  return cut < 0 ? [text, ''] : [text.slice(0, cut + 1), text.slice(cut + 2)]
}
