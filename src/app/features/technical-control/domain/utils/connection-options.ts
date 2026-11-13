import { ConnectionOption } from '@shared/domain/models/catalog.models';

export const isSelectable = (options: readonly ConnectionOption[], value: string | null): boolean => options.some((o) => o.value === value && o.availability === 'available');

// La opción con que arranca una pantalla: la recomendada que se pueda elegir o, si no hay, la primera disponible. Las `coming_soon` nunca se preseleccionan.
export function defaultOption(options: readonly ConnectionOption[]): string | null {
  const available = options.filter((o) => o.availability === 'available');
  return (available.find((o) => o.tags.includes('recommended')) ?? available[0])?.value ?? null;
}
