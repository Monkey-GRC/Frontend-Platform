import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Execution } from '@shared/domain/models/technical-control.models';
import { ESTIMATE_CAP, ExecutionProgress, SLOW_AFTER_SECONDS, estimateProgress } from './execution-progress';

const agoIso = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();
const execution = (status: Execution['status'], startedSecondsAgo: number | null): Execution => ({
  id: 'x1', status, origin: 'manual', queued_at: null, started_at: startedSecondsAgo === null ? null : agoIso(startedSecondsAgo), finished_at: null, failure_reason: null, failure_message: null,
});

describe('estimateProgress', () => {
  it('starts at 0, only goes up, and never reaches 100 by itself', () => {
    expect(estimateProgress(0, 'running')).toBe(0);
    let last = -1;
    for (const s of [0, 10, 30, 60, 120, 240, 360, 600, 1200, 100000]) {
      const p = estimateProgress(s, 'running');
      expect(p).toBeGreaterThanOrEqual(last);
      expect(p).toBeLessThanOrEqual(ESTIMATE_CAP);
      last = p;
    }
    expect(estimateProgress(100000, 'running')).toBe(ESTIMATE_CAP);
  });

  it('at the usual 6 minutes it is well advanced but not done', () => {
    const p = estimateProgress(360, 'running');
    expect(p).toBeGreaterThan(75);
    expect(p).toBeLessThan(ESTIMATE_CAP);
  });

  it('while queued it barely moves', () => {
    expect(estimateProgress(500, 'queued')).toBeLessThanOrEqual(3);
  });

  it('ignores a negative time (a clock a bit off)', () => {
    expect(estimateProgress(-30, 'running')).toBe(0);
  });
});

describe('ExecutionProgress', () => {
  let fixture: ComponentFixture<ExecutionProgress>;
  const q = <T extends HTMLElement>(s: string) => (fixture.nativeElement as HTMLElement).querySelector(s) as T | null;

  function show(e: Execution) {
    TestBed.configureTestingModule({ imports: [ExecutionProgress], providers: [provideTranslateService()] });
    fixture = TestBed.createComponent(ExecutionProgress);
    fixture.componentRef.setInput('execution', e);
    fixture.detectChanges();
  }

  it('shows a big percentage and a bar that says the same, labelled as an estimate', () => {
    show(execution('running', 120));
    const percent = fixture.componentInstance.percent();
    expect(percent).toBeGreaterThan(0);
    expect(q('[data-percent]')!.textContent).toContain(String(percent));
    expect(q('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe(String(percent));
    expect(q<HTMLElement>('[data-bar]')!.style.width).toBe(`${percent}%`);
    expect(fixture.nativeElement.textContent).toContain('PROGRESS.ESTIMATED');
  });

  it('says what step it is in and how long it has been', () => {
    show(execution('running', 125));
    expect(q('[data-stage]')!.textContent).toContain('PROGRESS.STAGE_');
    expect(q('[data-elapsed]')!.textContent).toContain('PROGRESS.ELAPSED');
    expect(fixture.componentInstance.clock()).toMatch(/^2:0\d$/);
  });

  it('goes through the steps as the percentage grows', () => {
    const stageAt = (seconds: number) => { TestBed.resetTestingModule(); show(execution('running', seconds)); return fixture.componentInstance.stage(); };
    expect(stageAt(2)).toBe('CONNECT');
    expect(stageAt(60)).toBe('READ');
    expect(stageAt(200)).toBe('CHECK');
    expect(stageAt(500)).toBe('RESULTS');
  });

  it('queued: says it is in the queue and prepares', () => {
    show(execution('queued', null));
    expect(fixture.componentInstance.stage()).toBe('PREPARE');
    expect(fixture.nativeElement.textContent).toContain('TITLE_QUEUED');
  });

  it('after a long time it says it is slower than usual but still running', () => {
    show(execution('running', 60));
    expect(q('[data-slow]')).toBeNull();
    TestBed.resetTestingModule();
    show(execution('running', SLOW_AFTER_SECONDS + 5));
    expect(q('[data-slow]')).not.toBeNull();
  });

  it('never names the provider of the scan engine', () => {
    show(execution('running', 30));
    expect((fixture.nativeElement.textContent as string).toLowerCase()).not.toContain('prowler');
  });
});
