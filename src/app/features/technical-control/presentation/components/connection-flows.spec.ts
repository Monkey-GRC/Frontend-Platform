import { CONNECTION_FLOW_PLATFORMS } from '@shared/domain/utils/connection-flow-platforms';
import { CONNECTION_FLOWS, connectionFlow } from './connection-flows';
import { AwsConnectionFlow } from './aws-connection-flow/aws-connection-flow';
import { GcpConnectionFlow } from './gcp-connection-flow/gcp-connection-flow';
import { ServerConnectionFlow } from './server-connection-flow/server-connection-flow';

describe('connectionFlow', () => {
  it('cada plataforma disponible tiene su recorrido: nubes con su asistente, servidores con el de la sonda (D113)', () => {
    expect(connectionFlow('aws')).toBe(AwsConnectionFlow);
    expect(connectionFlow('gcp')).toBe(GcpConnectionFlow);
    expect(connectionFlow('linux')).toBe(ServerConnectionFlow);
    expect(connectionFlow('windows')).toBe(ServerConnectionFlow);
  });

  it('la lista compartida con la pantalla de «Nueva conexión» coincide con los recorridos registrados', () => {
    expect([...CONNECTION_FLOW_PLATFORMS].sort()).toEqual(Object.keys(CONNECTION_FLOWS).sort());
  });

  it('una plataforma sin recorrido (o un nombre que no es de la lista) no abre ninguno', () => {
    expect(connectionFlow('aix')).toBeNull();
    expect(connectionFlow('constructor')).toBeNull();
  });
});
