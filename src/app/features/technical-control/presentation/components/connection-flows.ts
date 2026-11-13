import { Type } from '@angular/core';
import { AwsConnectionFlow } from './aws-connection-flow/aws-connection-flow';
import { GcpConnectionFlow } from './gcp-connection-flow/gcp-connection-flow';

// La única lista de plataformas con asistente de conexión: código de la plataforma → su recorrido. Añadir una es tocar este sitio.
// Todos los recorridos reciben los mismos datos (`platform`, `service`, `otherServices`, `criticalities`, `resume`) y emiten `closed` y `openConnection`.
export const CONNECTION_FLOWS: Readonly<Record<string, Type<unknown>>> = {
  gcp: GcpConnectionFlow,
  aws: AwsConnectionFlow,
};

export const connectionFlow = (platform: string): Type<unknown> | null => (Object.hasOwn(CONNECTION_FLOWS, platform) ? CONNECTION_FLOWS[platform] : null);
