import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Asset } from '@shared/domain/models/technical-control.models';
import { ConnectionsList } from './connections-list';

const ASSET = { id: 'a1', code: 'AC-01', name: 'Cuenta principal', connection_category: 'ac_01', type: 'cloud', provisioning: { connection_status: 'active' } } as unknown as Asset;

describe('ConnectionsList', () => {
  let fixture: ComponentFixture<ConnectionsList>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConnectionsList], providers: [provideTranslateService(), provideRouter([])] });
    fixture = TestBed.createComponent(ConnectionsList);
    fixture.componentRef.setInput('serviceId', 's1');
    fixture.componentRef.setInput('assets', [ASSET]);
    fixture.detectChanges();
  });

  it('has a single Tab stop per row: the link; the row itself opens with the mouse and has no tabindex', () => {
    const row = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('tbody tr')!;
    expect(row.hasAttribute('tabindex')).toBeFalse();
    expect(row.querySelectorAll('a[href]').length).toBe(1);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    row.click();
    expect(navigate).toHaveBeenCalledWith(['/services', 's1', 'connections', 'a1']);
  });
});
