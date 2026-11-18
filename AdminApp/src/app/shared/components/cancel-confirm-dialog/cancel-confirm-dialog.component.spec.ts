import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import { CancelConfirmDialogComponent } from './cancel-confirm-dialog.component';

describe('CancelConfirmDialogComponent', () => {
  let fixture: ComponentFixture<CancelConfirmDialogComponent>;
  let component: CancelConfirmDialogComponent;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    close = vi.fn();

    await TestBed.configureTestingModule({
      imports: [CancelConfirmDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { message: 'Do you really want to cancel?' } },
        { provide: DialogRef, useValue: { close } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CancelConfirmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the message and the default button labels', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Do you really want to cancel?');
    expect(component.confirmText).toBe('Yes');
    expect(component.cancelText).toBe('No');
  });

  it('closes with true when the user confirms', () => {
    component.onConfirm();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('closes with false when the user declines', () => {
    component.onCancel();

    expect(close).toHaveBeenCalledWith(false);
  });
});
