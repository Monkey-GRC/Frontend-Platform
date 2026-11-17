import { Asset } from '@shared/domain/models/technical-control.models';

// Retomar una conexión a medias. El activo nace `pending` en cuanto el cliente termina de dar sus datos; si sale del asistente ahí queda. El paso al que vuelve se DERIVA de lo que
// el servidor ya tiene (nada se guarda en el navegador): sin entregar el dato que cierra el acceso, vuelve a «Dar acceso»; con él, a «Comprobar». Una conexión comprobada ya no se retoma.
export type ResumeStep = 'access' | 'check';

export function resumeStep(asset: Pick<Asset, 'provisioning' | 'connection_setup'>): ResumeStep | null {
  if (!['pending', 'failed'].includes(asset.provisioning.connection_status)) return null;
  const setup = asset.connection_setup;
  switch (asset.provisioning.connection_method ?? setup?.method) {
    case 'identity_federation':
      return setup?.project_number ? 'check' : 'access';
    case 'readonly_role':
      return setup?.role_arn ? 'check' : 'access';
    case 'access_keys':
      return 'check';
    default:
      return null;
  }
}

export const canResumeConnection = (asset: Pick<Asset, 'provisioning' | 'connection_setup'>): boolean => resumeStep(asset) !== null;
