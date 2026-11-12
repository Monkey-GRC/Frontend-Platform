import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// El logo de una plataforma (D67): un icono cuadrado, a todo color y sin fondo, del mismo tamaño para todas (así ninguna se ve más grande que otra). Cada
// logo tiene dos archivos, `<logo_key>.svg` para el tema claro y `<logo_key>-dark.svg` para el oscuro, donde se aclaran solo los colores muy oscuros (el texto
// de AWS, el logo de Apple). Es decorativo: el nombre de la plataforma va siempre como texto al lado, así que el `alt` va vacío. Se muestra con <img>: un SVG
// nunca se inyecta como HTML. Los archivos están en `public/providers/`.
@Component({
  selector: 'app-provider-logo',
  templateUrl: './provider-logo.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderLogo {
  readonly logoKey = input.required<string>();
  // `card` es la baldosa de la tarjeta del marketplace, pequeña y al lado del nombre (como en un catálogo de integraciones).
  readonly size = input<'lg' | 'card' | 'md' | 'sm'>('md');
}
