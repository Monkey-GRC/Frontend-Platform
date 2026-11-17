import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { Asset, Platform } from '@shared/domain/models/technical-control.models';
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

  it('offers «Continue setup» only on a pending connection of a platform with the wizard, and it does not open the row', () => {
    const pending = { ...ASSET, id: 'a2', platform: 'aws', provisioning: { connection_status: 'pending', connection_method: 'readonly_role' }, connection_setup: { method: 'readonly_role', role_arn: null, steps: [] } } as unknown as Asset;
    fixture.componentRef.setInput('assets', [ASSET, pending]);
    fixture.detectChanges();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a[data-resume]');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toContain('/services/s1/connections/new/ac_01/aws');
    expect(links[0].getAttribute('href')).toContain('assetId=a2');
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    links[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows each connection with the logo and the account noun of its own platform', () => {
    const platform = (code: string, name: string): Platform => ({ code, name, logo_key: code, availability: 'available', connection_methods: [] });
    const gcp = { ...ASSET, id: 'g1', platform: 'gcp', external_account_id: 'mi-proyecto', provisioning: { connection_status: 'active' } } as unknown as Asset;
    const aws = { ...ASSET, id: 'a9', platform: 'aws', external_account_id: '123456789012', provisioning: { connection_status: 'active' } } as unknown as Asset;
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', { TECHNICAL_CONTROL: { ACCOUNT: { AWS: 'Cuenta {{account}}', GCP: 'Proyecto {{account}}', GENERIC: 'Cuenta {{account}}' } } });
    translate.use('es');
    fixture.componentRef.setInput('platforms', { gcp: platform('gcp', 'Google Cloud (GCP)'), aws: platform('aws', 'Amazon Web Services') });
    fixture.componentRef.setInput('assets', [gcp, aws]);
    fixture.detectChanges();
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'));
    expect(rows[0].textContent).toContain('Google Cloud (GCP) · Proyecto mi-proyecto');
    expect(rows[1].textContent).toContain('Amazon Web Services · Cuenta 123456789012');
    expect(rows[0].querySelector('app-provider-logo img')!.getAttribute('src')).toBe('/providers/gcp.svg');
    expect(rows[1].querySelector('app-provider-logo img')!.getAttribute('src')).toBe('/providers/aws.svg');
  });
});
