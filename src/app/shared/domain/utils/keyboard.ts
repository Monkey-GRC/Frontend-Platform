/** La tecla modificadora de los atajos de la app: ⌘ en Mac y iOS, Ctrl en el resto. Solo es para mostrarla; el atajo acepta las dos. */
export const modifierKeyLabel = (platform: string = typeof navigator === 'undefined' ? '' : navigator.platform): string =>
  /mac|iphone|ipad|ipod/i.test(platform) ? '⌘' : 'Ctrl';
