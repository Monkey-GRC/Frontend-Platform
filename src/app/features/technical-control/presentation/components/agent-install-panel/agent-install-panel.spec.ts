import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { AgentInstallReveal, AgentInstallState, Asset, Execution } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { AgentInstallPanel } from './agent-install-panel';

const outbound = { host: 'sonda.monkey.test', port: 1514 };
const version = { value: 'ubuntu_22_04_lts', label: 'Ubuntu 22.04 LTS' };

function state(partial: Partial<AgentInstallState>): AgentInstallState {
  return { status: 'not_started', failure_message: null, os: 'linux', os_version: version, expires_at: null, requires_outbound: outbound, connection: { status: 'pending', watching: true, last_sync_at: null }, ...partial };
}

const reveal: AgentInstallReveal = {
  os: 'linux',
  os_version: version,
  requires_outbound: outbound,
  options: [{ kind: 'command', label: 'Bash', shell: 'bash', value: 'curl -fsSL https://x.test/agent.sh | sudo bash -s -- --key SECRETO' }],
};

function assetOf(status: 'pending' | 'connected'): Asset {
  return { id: 'a1', name: 'Servidor BD', agent: { status, os: 'linux', os_version: version }, connection_setup: { method: 'agent', steps: ['Entra como administrador'] } } as unknown as Asset;
}

// El panel de instalación de la sonda (D112): el comando lleva la clave del servidor, así que solo se pide cuando el cliente lo pulsa, se muestra una vez
// y no se guarda en ninguna parte del navegador.
describe('AgentInstallPanel', () => {
  let fixture: ComponentFixture<AgentInstallPanel>;
  let api: jasmine.SpyObj<TechnicalControlService>;
  const el = () => fixture.nativeElement as HTMLElement;
  const buttonWith = (text: string) => Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

  function open(current: AgentInstallState, asset: Asset = assetOf('pending')) {
    api = jasmine.createSpyObj<TechnicalControlService>('TechnicalControlService', ['agentInstall', 'startAgentInstall', 'revealAgentInstall', 'regenerateAgentInstall', 'getAsset', 'evaluate', 'lastExecution']);
    api.agentInstall.and.returnValue(of(current));
    api.getAsset.and.returnValue(of(asset));
    TestBed.configureTestingModule({ imports: [AgentInstallPanel], providers: [provideTranslateService(), { provide: TechnicalControlService, useValue: api }] });
    fixture = TestBed.createComponent(AgentInstallPanel);
    fixture.componentRef.setInput('asset', asset);
    fixture.detectChanges();
  }

  it('shows the loading region while it reads the installation state', () => {
    open(state({ status: 'not_started' }));
    api.agentInstall.and.returnValue(new Subject<AgentInstallState>());
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(el().querySelector('[data-agent-loading][aria-busy="true"]')).not.toBeNull();
    expect(el().querySelectorAll('[data-load-progress]').length).toBe(1);
  });

  it('tells the client what to have at hand and offers to prepare the key', () => {
    open(state({ status: 'not_started' }));
    expect(el().textContent).toContain('BEFORE_OUTBOUND');
    expect(buttonWith('AGENT.START')).toBeDefined();
    expect(api.revealAgentInstall).not.toHaveBeenCalled();
  });

  it('never asks for the command on its own, not even when it is ready', () => {
    open(state({ status: 'ready', expires_at: '2026-11-12T10:15:00Z' }));
    expect(api.revealAgentInstall).not.toHaveBeenCalled();
    expect(el().querySelector('[data-agent-command]')).toBeNull();
    expect(buttonWith('AGENT.SHOW')).toBeDefined();
  });

  it('starts the preparation when the client asks', () => {
    open(state({ status: 'not_started' }));
    api.startAgentInstall.and.returnValue(of(state({ status: 'preparing' })));
    buttonWith('AGENT.START')!.click();
    fixture.detectChanges();
    expect(api.startAgentInstall).toHaveBeenCalledOnceWith('a1');
    expect(el().textContent).toContain('AGENT.PREPARING');
  });

  it('shows the command once the client asks, only in memory, and warns it will not come back', () => {
    open(state({ status: 'ready' }));
    api.revealAgentInstall.and.returnValue(of(reveal));
    const setItem = spyOn(Storage.prototype, 'setItem').and.callThrough();
    buttonWith('AGENT.SHOW')!.click();
    fixture.detectChanges();
    expect(el().querySelector('[data-agent-command]')?.textContent).toContain('--key SECRETO');
    expect(el().textContent).toContain('AGENT.ONCE_WARNING');
    // Ni la clave ni el comando se guardan en el navegador.
    expect(setItem.calls.allArgs().flat().some((v) => String(v).includes('SECRETO'))).toBeFalse();
    // Ya mostrado, no se ofrece pedirlo otra vez.
    expect(buttonWith('AGENT.SHOW')).toBeUndefined();
    expect(el().querySelector('[data-agent-waiting]')).not.toBeNull();
  });

  it('forgets the command when the screen goes away', () => {
    open(state({ status: 'ready' }));
    api.revealAgentInstall.and.returnValue(of(reveal));
    buttonWith('AGENT.SHOW')!.click();
    expect(fixture.componentInstance.reveal()).not.toBeNull();
    fixture.destroy();
    expect(fixture.componentInstance.reveal()).toBeNull();
  });

  it('reads the state again and explains when the command was already shown or expired', () => {
    open(state({ status: 'ready' }));
    api.revealAgentInstall.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { error: { code: 'AGENT_INSTALL_NOT_READY' } } })));
    api.agentInstall.and.returnValue(of(state({ status: 'delivered' })));
    buttonWith('AGENT.SHOW')!.click();
    fixture.detectChanges();
    expect(api.agentInstall).toHaveBeenCalledTimes(2);
    expect(el().textContent).toContain('AGENT.NOT_READY');
    expect(buttonWith('AGENT.REGENERATE')).toBeDefined();
  });

  it('asks for confirmation before generating a new key, since the old one stops working', () => {
    open(state({ status: 'delivered' }));
    api.regenerateAgentInstall.and.returnValue(of(state({ status: 'preparing' })));
    buttonWith('AGENT.REGENERATE')!.click();
    fixture.detectChanges();
    expect(api.regenerateAgentInstall).not.toHaveBeenCalled();
    buttonWith('AGENT.REGENERATE_YES')!.click();
    fixture.detectChanges();
    expect(api.regenerateAgentInstall).toHaveBeenCalledOnceWith('a1');
    expect(el().textContent).toContain('AGENT.PREPARING');
  });

  it('shows the translated reason when the preparation failed, and lets the client retry', () => {
    open(state({ status: 'failed', failure_message: 'No pudimos crear el agente.' }));
    expect(el().textContent).toContain('No pudimos crear el agente.');
    expect(buttonWith('AGENT.RETRY')).toBeDefined();
  });

  it('says so, without a scary error, when this Monkey installation cannot install yet', () => {
    api = jasmine.createSpyObj<TechnicalControlService>('TechnicalControlService', ['agentInstall']);
    api.agentInstall.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503, error: { error: { code: 'AGENT_INSTALL_UNAVAILABLE' } } })));
    TestBed.configureTestingModule({ imports: [AgentInstallPanel], providers: [provideTranslateService(), { provide: TechnicalControlService, useValue: api }] });
    fixture = TestBed.createComponent(AgentInstallPanel);
    fixture.componentRef.setInput('asset', assetOf('pending'));
    fixture.detectChanges();
    expect(el().textContent).toContain('AGENT.UNAVAILABLE');
    expect(el().querySelector('[role=alert]')).toBeNull();
  });

  it('celebrates the connection and stops offering the install steps', () => {
    open(state({ status: 'delivered' }), assetOf('connected'));
    expect(el().querySelector('[data-agent-connected]')).not.toBeNull();
    expect(buttonWith('AGENT.START')).toBeUndefined();
    expect(buttonWith('AGENT.REGENERATE')).toBeUndefined();
  });

  // La lectura automática (D112): Monkey busca al servidor solo; la pantalla dice en qué punto está y nunca obliga a hacer nada.
  describe('connection after the command was delivered', () => {
    const disconnected = (): Asset => ({ ...assetOf('pending'), agent: { status: 'disconnected', os: 'linux', os_version: version, last_sync_at: '2026-11-11T22:00:00Z' } }) as unknown as Asset;

    it('says Monkey keeps looking on its own, so the client has nothing else to do', () => {
      open(state({ status: 'delivered', connection: { status: 'pending', watching: true, last_sync_at: null } }));
      expect(el().querySelector('[data-agent-waiting]')).not.toBeNull();
      expect(el().textContent).toContain('AGENT.WAITING_AUTO');
      expect(el().querySelector('[data-agent-expired]')).toBeNull();
      // «Comprobar ahora» es un atajo, no un paso obligatorio.
      expect(buttonWith('AGENT.CHECK_NOW')).toBeDefined();
    });

    it('explains what to check when Monkey stopped looking, and offers to check now', () => {
      open(state({ status: 'delivered', connection: { status: 'pending', watching: false, last_sync_at: null } }));
      expect(el().querySelector('[data-agent-expired]')).not.toBeNull();
      expect(el().querySelector('[data-agent-waiting]')).toBeNull();
      expect(buttonWith('AGENT.CHECK_NOW')).toBeDefined();
      expect(buttonWith('AGENT.REGENERATE')).toBeDefined();
    });

    it('says when the server stopped reporting and shows the last review', () => {
      open(state({ status: 'delivered', connection: { status: 'disconnected', watching: true, last_sync_at: '2026-11-11T22:00:00Z' } }), disconnected());
      expect(el().querySelector('[data-agent-disconnected]')).not.toBeNull();
      expect(el().textContent).toContain('AGENT.LAST_REVIEW');
    });

    it('shows the last review of a connected server', () => {
      const connected = { ...assetOf('connected'), agent: { status: 'connected', os: 'linux', os_version: version, last_sync_at: '2026-11-12T10:00:00Z' } } as unknown as Asset;
      open(state({ status: 'delivered' }), connected);
      expect(el().querySelector('[data-agent-last-review]')).not.toBeNull();
      expect(buttonWith('AGENT.CHECK_NOW')).toBeUndefined();
    });

    it('checks now: asks for a reading and, when it ends well, refreshes the server', fakeAsync(() => {
      open(state({ status: 'delivered' }));
      api.evaluate.and.returnValue(of({ id: 'e1', status: 'queued' } as Execution));
      api.lastExecution.and.returnValue(of({ id: 'e1', status: 'completed', failure_message: null } as Execution));
      const changed: Asset[] = [];
      fixture.componentInstance.changed.subscribe((a) => changed.push(a));
      buttonWith('AGENT.CHECK_NOW')!.click();
      expect(api.evaluate).toHaveBeenCalledOnceWith('a1');
      tick(3000);
      fixture.detectChanges();
      expect(changed.length).toBe(1);
      expect(fixture.componentInstance.busy()).toBeNull();
      discardPeriodicTasks();
    }));

    it('checks now: shows the translated reason when the reading fails (never the probe message)', fakeAsync(() => {
      open(state({ status: 'delivered', connection: { status: 'pending', watching: false, last_sync_at: null } }));
      api.evaluate.and.returnValue(of({ id: 'e1', status: 'queued' } as Execution));
      api.lastExecution.and.returnValue(of({ id: 'e1', status: 'failed', failure_message: 'La sonda de este servidor todavía no entregó su primera evaluación.' } as Execution));
      buttonWith('AGENT.CHECK_NOW')!.click();
      tick(3000);
      fixture.detectChanges();
      expect(el().textContent).toContain('todavía no entregó su primera evaluación');
      expect(fixture.componentInstance.busy()).toBeNull();
      discardPeriodicTasks();
    }));

    it('checks now: says a check is already running instead of failing', () => {
      open(state({ status: 'delivered' }));
      api.evaluate.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { error: { code: 'EXECUTION_IN_PROGRESS' } } })));
      buttonWith('AGENT.CHECK_NOW')!.click();
      fixture.detectChanges();
      expect(el().textContent).toContain('AGENT.CHECK_IN_PROGRESS');
      expect(el().querySelector('[role=alert]')).toBeNull();
    });
  });

  it('offers the file as a download for Windows, next to the command', () => {
    open(state({ status: 'ready', os: 'windows' }));
    api.revealAgentInstall.and.returnValue(
      of({ ...reveal, os: 'windows', options: [...reveal.options, { kind: 'file', label: 'PowerShell', filename: 'instalar-monkey.ps1', content: 'x' }] }),
    );
    buttonWith('AGENT.SHOW')!.click();
    fixture.detectChanges();
    expect(buttonWith('AGENT.DOWNLOAD')).toBeDefined();
  });
});
