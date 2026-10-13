// La página que devuelve el backend (contracts/conventions.md): `page` arranca en 1 y `page_size` llega hasta 100.
export interface PageInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// «Mostrando 26–50 de 120». Con la lista vacía, 0–0.
export function visibleRange(page: PageInfo): { from: number; to: number } {
  if (page.total === 0) return { from: 0, to: 0 };
  const from = (page.page - 1) * page.pageSize + 1;
  return { from, to: Math.min(page.page * page.pageSize, page.total) };
}

export function canGoBack(page: PageInfo): boolean {
  return page.page > 1;
}

export function canGoForward(page: PageInfo): boolean {
  return page.page < page.totalPages;
}
