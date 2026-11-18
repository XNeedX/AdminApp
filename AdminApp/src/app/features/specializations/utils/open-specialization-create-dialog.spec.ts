import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog, DialogConfig } from '@angular/cdk/dialog';
import { Subject, firstValueFrom } from 'rxjs';

import { SpecializationCreateDialogComponent } from '../dialogs/specialization-create-dialog/specialization-create-dialog.component';
import { openSpecializationCreateDialog } from './open-specialization-create-dialog';

/**
 * Regression guard: a space-separated `panelClass` string makes CDK call
 * `DOMTokenList.add('w-full max-w-3xl')`, which throws `InvalidCharacterError` inside
 * `dialog.open` and freezes the Create action.
 */
describe('openSpecializationCreateDialog', () => {
  let closed: Subject<unknown>;

  let openedComponent: unknown;
  let openedConfig: DialogConfig | undefined;

  const open = vi.fn((component: unknown, config: DialogConfig) => {
    openedComponent = component;
    openedConfig = config;
    return { closed };
  });

  beforeEach(() => {
    open.mockClear();
    closed = new Subject<unknown>();
    openedComponent = undefined;
    openedConfig = undefined;
  });

  function openDialog() {
    return openSpecializationCreateDialog({ open } as unknown as Dialog);
  }

  it('opens the create dialog component', () => {
    openDialog();

    expect(open).toHaveBeenCalledTimes(1);
    expect(openedComponent).toBe(SpecializationCreateDialogComponent);
  });

  it('passes overlay classes as an array of single class names', () => {
    openDialog();

    const panelClass = openedConfig?.panelClass as string[];

    expect(Array.isArray(panelClass)).toBe(true);
    expect(panelClass).toEqual(['w-full', 'max-w-3xl']);
    for (const cssClass of panelClass) {
      expect(cssClass).toBe(cssClass.trim());
      expect(cssClass).not.toContain(' ');
    }
    expect(openedConfig?.backdropClass).toBe('bg-gray-900/50');
  });

  it('keeps the dialog non-dismissible by backdrop click and wired to its title', () => {
    openDialog();

    expect(openedConfig).toMatchObject({
      disableClose: true,
      ariaLabelledBy: 'specialization-create-dialog-title',
      restoreFocus: true,
    });
  });

  it('emits the created id', async () => {
    const result = firstValueFrom(openDialog());

    closed.next('specialization-1');
    closed.complete();

    await expect(result).resolves.toBe('specialization-1');
  });

  it('emits null when the dialog closes without a result', async () => {
    const result = firstValueFrom(openDialog());

    closed.next(undefined);
    closed.complete();

    await expect(result).resolves.toBeNull();
  });
});
