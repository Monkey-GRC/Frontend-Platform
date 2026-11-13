import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { Asset, Platform, TechnicalControlState } from '@shared/domain/models/technical-control.models';
import { assetDetail, platformsByCode } from './platform-label';

const GCP: Platform = { code: 'gcp', name: 'Google Cloud (GCP)', logo_key: 'gcp', availability: 'available', connection_methods: ['identity_federation'] };
const AWS: Platform = { code: 'aws', name: 'Amazon Web Services', logo_key: 'aws', availability: 'available', connection_methods: ['readonly_role'] };
const cloud = (platform: string, over: Partial<Asset> = {}) =>
  ({ connection_category: 'ac_01', platform, external_account_id: 'mi-proyecto', provisioning: { connection_status: 'active', regions: ['us-east1'] }, ...over }) as unknown as Asset;

describe('platform-label', () => {
  let translate: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslateService()] });
    translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', { TECHNICAL_CONTROL: { ACCOUNT: { AWS: 'Cuenta {{account}}', GCP: 'Proyecto {{account}}', GENERIC: 'Cuenta {{account}}' } } });
    translate.use('es');
  });

  it('indexes the platforms of every capability by code', () => {
    const state = { applicable_capabilities: [{ platforms: [AWS] }, { platforms: [GCP] }] } as unknown as TechnicalControlState;
    expect(Object.keys(platformsByCode(state))).toEqual(['aws', 'gcp']);
    expect(platformsByCode(null)).toEqual({});
  });

  it('says «Proyecto» for a GCP asset and «Cuenta» for an AWS one, each with its own platform name', () => {
    expect(assetDetail(translate, cloud('gcp'), GCP)).toBe('Google Cloud (GCP) · Proyecto mi-proyecto · us-east1');
    expect(assetDetail(translate, cloud('aws', { external_account_id: '123456789012' }), AWS)).toBe('Amazon Web Services · Cuenta 123456789012 · us-east1');
  });

  it('falls back to the generic noun for a platform without its own and to the code when the catalog has not loaded', () => {
    expect(assetDetail(translate, cloud('azure'), undefined)).toBe('azure · Cuenta mi-proyecto · us-east1');
  });

  it('describes a non-cloud connection by its network data', () => {
    const server = { connection_category: 'ac_02', platform: 'linux', ip_address: '10.0.0.5', location: 'DC1', provisioning: {} } as unknown as Asset;
    expect(assetDetail(translate, server, undefined)).toBe('linux · 10.0.0.5 · DC1');
  });
});
