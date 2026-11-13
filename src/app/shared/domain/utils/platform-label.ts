import { TranslateService } from '@ngx-translate/core';
import { Asset, Platform, TechnicalControlState } from '@shared/domain/models/technical-control.models';

/** Las plataformas del catálogo por su código, para saber el nombre y el logo de la de un activo. */
export function platformsByCode(state: TechnicalControlState | null): Record<string, Platform> {
  return Object.fromEntries((state?.applicable_capabilities ?? []).flatMap((c) => c.platforms).map((p) => [p.code, p]));
}

// Cómo se llama la cuenta en cada plataforma («Cuenta» en AWS, «Proyecto» en GCP): `TECHNICAL_CONTROL.ACCOUNT.<CÓDIGO>` y, si esa plataforma no tiene su clave, la genérica.
function accountLabel(translate: TranslateService, platformCode: string | null | undefined, account: string): string {
  const key = `TECHNICAL_CONTROL.ACCOUNT.${(platformCode ?? '').toUpperCase()}`;
  const text = platformCode ? translate.instant(key, { account }) : key;
  return text === key ? translate.instant('TECHNICAL_CONTROL.ACCOUNT.GENERIC', { account }) : text;
}

/** La línea que identifica la conexión de un activo: el nombre de su plataforma y su cuenta («Google Cloud (GCP) · Proyecto mi-proyecto») más las regiones; sin cuenta, sus datos de red. */
export function assetDetail(translate: TranslateService, asset: Asset, platform: Platform | undefined): string {
  const name = platform?.name ?? asset.platform;
  if (asset.connection_category === 'ac_01' && asset.external_account_id) {
    const regions = (asset.provisioning.regions ?? []).join(', ');
    return [name, accountLabel(translate, asset.platform, asset.external_account_id), regions].filter(Boolean).join(' · ');
  }
  return [name, asset.ip_address, asset.location].filter(Boolean).join(' · ');
}
