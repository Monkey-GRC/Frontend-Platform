import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { PageInfo } from '@shared/domain/utils/pagination';
import { StatusBadge } from '../status-badge/status-badge';
import { DataTable, TableCell, TableColumn } from './data-table';

interface Row { id: number; name: string; status: string }

@Component({
  imports: [DataTable, TableCell, StatusBadge],
  template: `
    <app-data-table
      captionKey="TEST.CAPTION"
      [columns]="columns"
      [rows]="rows()"
      [rowKey]="byId"
      [page]="page()"
      [loading]="loading()"
      [clickable]="true"
      (pageChange)="pages.push($event)"
      (pageSizeChange)="sizes.push($event)"
      (rowClick)="clicked.push($event.id)"
    >
      <ng-template appCell="status" let-row><app-status-badge [status]="row.status" size="sm" /></ng-template>
    </app-data-table>
  `,
})
class Host {
  columns: TableColumn<Row>[] = [
    { key: 'name', headerKey: 'TEST.NAME', value: (r) => r.name },
    { key: 'status', headerKey: 'TEST.STATUS' },
  ];
  rows = signal<Row[]>([
    { id: 1, name: 'Acceso con MFA', status: 'ready' },
    { id: 2, name: 'Copias de seguridad', status: 'not_measured' },
  ]);
  page = signal<PageInfo | null>({ page: 2, pageSize: 25, total: 60, totalPages: 3 });
  loading = signal(false);
  pages: number[] = [];
  sizes: number[] = [];
  clicked: number[] = [];
  byId = (r: Row) => r.id;
}

describe('DataTable', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the rows, using the cell template when there is one', () => {
    const rows = el().querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Acceso con MFA');
    expect(rows[0].querySelector('app-status-badge')).not.toBeNull();
    expect(rows[1].querySelector('[data-status="not_measured"]')).not.toBeNull();
  });

  it('stacks into cards below the large breakpoint, each cell labelled with its column, so nobody has to scroll sideways', () => {
    const table = el().querySelector('table')!;
    expect(table.className).toContain('block');
    expect(table.className).toContain('lg:table');
    expect(table.className).not.toContain('min-w-');
    expect(el().querySelector('thead')!.className).toContain('hidden');
    const cells = Array.from(el().querySelectorAll('tbody tr:first-child td'));
    expect(cells.map((c) => c.getAttribute('data-label'))).toEqual(['TEST.NAME', 'TEST.STATUS']);
  });

  it('has a hidden caption and column headers for screen readers', () => {
    expect(el().querySelector('caption')!.textContent).toContain('TEST.CAPTION');
    expect(el().querySelectorAll('th[scope="col"]').length).toBe(2);
  });

  it('shows where you are and goes to the previous and next page', () => {
    expect(el().textContent).toContain('COMMON.TABLE.SHOWING');
    const [prev, next] = Array.from(el().querySelectorAll<HTMLButtonElement>('nav button'));
    prev.click();
    next.click();
    expect(host.pages).toEqual([1, 3]);
  });

  it('disables the edges of the pagination', () => {
    host.page.set({ page: 1, pageSize: 25, total: 60, totalPages: 3 });
    fixture.detectChanges();
    const [prev] = Array.from(el().querySelectorAll<HTMLButtonElement>('nav button'));
    expect(prev.disabled).toBeTrue();
    host.page.set({ page: 3, pageSize: 25, total: 60, totalPages: 3 });
    fixture.detectChanges();
    const buttons = Array.from(el().querySelectorAll<HTMLButtonElement>('nav button'));
    expect(buttons[1].disabled).toBeTrue();
  });

  it('emits the new page size', () => {
    const select = el().querySelector('select') as HTMLSelectElement;
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    expect(host.sizes).toEqual([50]);
  });

  it('opens a row with click and with the keyboard', () => {
    const row = el().querySelectorAll<HTMLElement>('tbody tr')[1];
    expect(row.getAttribute('tabindex')).toBe('0');
    row.click();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(host.clicked).toEqual([2, 2]);
  });

  it('shows the empty state when there are no rows', () => {
    host.rows.set([]);
    fixture.detectChanges();
    expect(el().querySelector('app-empty-state')).not.toBeNull();
    expect(el().textContent).toContain('COMMON.TABLE.EMPTY_TITLE');
  });

  it('shows a loading row instead of the rows, and marks the table busy', () => {
    host.loading.set(true);
    fixture.detectChanges();
    expect(el().querySelector('table')!.getAttribute('aria-busy')).toBe('true');
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
    expect(el().querySelector('app-empty-state')).toBeNull();
  });

  it('has no pagination bar without page info', () => {
    host.page.set(null);
    fixture.detectChanges();
    expect(el().querySelector('nav')).toBeNull();
  });
});
