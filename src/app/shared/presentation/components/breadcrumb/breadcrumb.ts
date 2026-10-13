import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

// Un paso de la ruta. El último no lleva enlace: es donde está el cliente.
export interface Crumb {
  label: string;
  link?: unknown[];
}

// La ruta que recorrió el cliente, encadenada: «Mis servicios › Facturación › Nueva conexión › Amazon Web Services». Cada paso anterior es un enlace para volver
// ahí. Es una navegación con nombre, una lista ordenada y el último paso marcado como la página actual (los separadores son decorativos para un lector de pantalla).
@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './breadcrumb.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Breadcrumb {
  readonly items = input.required<Crumb[]>();
}
