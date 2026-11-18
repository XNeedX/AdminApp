import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppTab, AppTabsComponent } from './app-tabs.component';

const TABS: readonly AppTab[] = [
  { id: 'personal', label: 'Personal information' },
  { id: 'results', label: 'Appointment results' },
];

const KEY_CODES = {
  End: 35,
  Home: 36,
  ArrowLeft: 37,
  ArrowRight: 39,
} as const;

@Component({
  standalone: true,
  imports: [AppTabsComponent],
  template: `
    <app-app-tabs
      [tabs]="tabs"
      [activeId]="active()"
      (activeChange)="onActiveChange($event)"
    />
    <section
      role="tabpanel"
      [id]="'panel-' + active()"
      [attr.aria-labelledby]="'tab-' + active()"
    >
      {{ active() }} panel
    </section>
  `,
})
class HostComponent {
  readonly tabs: readonly AppTab[] = TABS;
  readonly active = signal<string>('personal');
  readonly changes: string[] = [];

  onActiveChange(id: string): void {
    this.changes.push(id);
    this.active.set(id);
  }
}

describe('AppTabsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function tabs(): HTMLButtonElement[] {
    return Array.from(element().querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  }

  function press(key: keyof typeof KEY_CODES): void {
    const target = document.activeElement instanceof HTMLElement ? document.activeElement : element();
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

    Object.defineProperty(event, 'keyCode', { get: () => KEY_CODES[key] });
    target.dispatchEvent(event);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    document.body.appendChild(element());
  });

  afterEach(() => {
    fixture.destroy();
    element().remove();
  });

  it('renders a tablist with one tab per descriptor and marks the active tab', () => {
    const tablist = element().querySelector('[role="tablist"]');

    expect(tablist?.getAttribute('aria-orientation')).toBe('horizontal');
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual([
      'Personal information',
      'Appointment results',
    ]);
    expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs().map((tab) => tab.id)).toEqual(['tab-personal', 'tab-results']);
  });

  it('exposes only the active tab to the tab sequence', () => {
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1]);
  });

  it('addresses the panel through aria-controls and aria-labelledby', () => {
    const panel = element().querySelector('[role="tabpanel"]');

    expect(tabs().map((tab) => tab.getAttribute('aria-controls'))).toEqual([
      'panel-personal',
      'panel-results',
    ]);
    expect(panel?.id).toBe('panel-personal');
    expect(panel?.getAttribute('aria-labelledby')).toBe('tab-personal');
  });

  it('moves to the next tab with ArrowRight, activates it and focuses it', () => {
    tabs()[0].focus();
    press('ArrowRight');

    expect(host.changes).toEqual(['results']);
    expect(host.active()).toBe('results');
    expect(document.activeElement).toBe(tabs()[1]);
  });

  it('moves back with ArrowLeft and stops at the first tab', () => {
    tabs()[1].focus();
    tabs()[1].click();
    fixture.detectChanges();

    expect(host.active()).toBe('results');

    press('ArrowLeft');

    expect(host.changes).toEqual(['results', 'personal']);

    press('ArrowLeft');

    expect(host.changes).toEqual(['results', 'personal']);
    expect(document.activeElement).toBe(tabs()[0]);
  });

  it('jumps to the first and last tab with Home and End', () => {
    tabs()[1].focus();
    tabs()[1].click();
    fixture.detectChanges();

    expect(host.active()).toBe('results');

    press('Home');

    expect(host.active()).toBe('personal');
    expect(document.activeElement).toBe(tabs()[0]);

    press('End');

    expect(host.active()).toBe('results');
    expect(document.activeElement).toBe(tabs()[1]);
  });

  it('emits once per activation', () => {
    tabs()[0].focus();
    press('ArrowRight');
    press('ArrowLeft');

    expect(host.changes).toEqual(['results', 'personal']);
  });

  it('continues keyboard navigation from a tab selected with the mouse', () => {
    tabs()[1].focus();
    tabs()[1].click();
    fixture.detectChanges();

    expect(host.active()).toBe('results');

    press('Home');

    expect(host.changes).toEqual(['results', 'personal']);
    expect(document.activeElement).toBe(tabs()[0]);
  });
});
