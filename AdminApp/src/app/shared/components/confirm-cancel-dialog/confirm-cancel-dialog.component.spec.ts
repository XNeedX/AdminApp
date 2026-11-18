import { describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmCancelDialogComponent } from './confirm-cancel-dialog.component';

describe('ConfirmCancelDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmCancelDialogComponent>;
  let component: ConfirmCancelDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmCancelDialogComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmCancelDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component with default messages', () => {
    expect(component).toBeTruthy();
    expect(component.message()).toBe('Do you really want to cancel? Entered data will not be saved.');
    expect(component.confirmText()).toBe('Yes');
    expect(component.cancelText()).toBe('No');
  });

  it('should emit true when onConfirm is called', () => {
    let result: boolean | undefined;
    component.confirmed.subscribe((val) => (result = val));

    component.onConfirm();
    expect(result).toBe(true);
  });

  it('should emit false when onCancel is called', () => {
    let result: boolean | undefined;
    component.confirmed.subscribe((val) => (result = val));

    component.onCancel();
    expect(result).toBe(false);
  });
});
