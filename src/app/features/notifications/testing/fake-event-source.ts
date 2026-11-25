import { Provider } from '@angular/core';
import { EVENT_SOURCE_FACTORY } from '@features/notifications/domain/services/notification-stream.service';

/** Un EventSource a mano para las pruebas: la prueba dispara los eventos del servidor con `emit`. */
export class FakeEventSource {
  static all: FakeEventSource[] = [];
  closed = false;
  readonly listeners = new Map<string, ((event: Event) => void)[]>();

  constructor(readonly url: string) {
    FakeEventSource.all.push(this);
  }

  static get last(): FakeEventSource {
    return FakeEventSource.all[FakeEventSource.all.length - 1];
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data?: unknown): void {
    const event = data === undefined ? new Event(type) : (new MessageEvent(type, { data: JSON.stringify(data) }) as Event);
    (this.listeners.get(type) ?? []).forEach((l) => l(event));
  }
}

export function provideFakeEventSource(): Provider {
  FakeEventSource.all = [];
  return { provide: EVENT_SOURCE_FACTORY, useValue: (url: string) => new FakeEventSource(url) as unknown as EventSource };
}
