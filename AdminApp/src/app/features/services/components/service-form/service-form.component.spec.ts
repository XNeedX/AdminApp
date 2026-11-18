import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceFormComponent } from './service-form.component';
import { ServiceFormValue } from '../../models/service.model';

describe('ServiceFormComponent', () => {
  let fixture: ComponentFixture<ServiceFormComponent>;
  let component: ServiceFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ServiceFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function submitButton(): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector('button[type="submit"]');
    return button as HTMLButtonElement;
  }

  function fillValidForm(): void {
    component.form.controls.name.setValue('Blood test');
    component.form.controls.price.setValue(12.34);
    component.form.controls.category.setValue('Analyses');
    fixture.detectChanges();
  }

  it('defaults the status to Active and leaves name, price and category empty', () => {
    expect(component.form.controls.status.value).toBe('Active');
    expect(component.form.controls.name.value).toBe('');
    expect(component.form.controls.price.value).toBeNull();
    expect(component.form.controls.category.value).toBe('');
  });

  it('hides messages until the control is touched', () => {
    expect(component.nameMessage()).toBeNull();
    expect(component.priceMessage()).toBeNull();
    expect(component.categoryMessage()).toBeNull();

    component.form.controls.name.markAsTouched();
    component.form.controls.price.markAsTouched();
    component.form.controls.category.markAsTouched();

    expect(component.nameMessage()).toBe('Please, enter the name');
    expect(component.priceMessage()).toBe('Please, enter the price');
    expect(component.categoryMessage()).toBe('Please, choose the service category');
  });

  it('shows the exact messages for an empty name, price and category', () => {
    component.form.controls.name.markAsTouched();
    component.form.controls.price.markAsTouched();
    component.form.controls.category.markAsTouched();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Please, enter the name');
    expect(text).toContain('Please, enter the price');
    expect(text).toContain('Please, choose the service category');
  });

  it('treats a whitespace-only name as empty', () => {
    component.form.controls.name.setValue('   ');
    component.form.controls.name.markAsTouched();

    expect(component.nameMessage()).toBe('Please, enter the name');
    expect(component.form.controls.name.hasError('required')).toBe(true);
  });

  it('reports an invalid price for non-positive and over-precise values', () => {
    const price = component.form.controls.price;

    for (const value of [0, -5, Number.NaN, 0.001, 12.345]) {
      price.setValue(value);
      price.markAsTouched();
      expect(component.priceMessage()).toBe("You've entered an invalid price");
    }

    price.setValue(12.34);
    expect(component.priceMessage()).toBeNull();
  });

  it('keeps the submit button disabled while the form is invalid', () => {
    expect(submitButton().disabled).toBe(true);

    fillValidForm();

    expect(submitButton().disabled).toBe(false);
  });

  it('labels the submit button according to the mode', () => {
    expect(submitButton().textContent?.trim()).toBe('Confirm');

    fixture.componentRef.setInput('mode', 'edit');
    fixture.detectChanges();

    expect(submitButton().textContent?.trim()).toBe('Save changes');
  });

  it('disables both footer buttons while submitting', () => {
    fillValidForm();
    fixture.componentRef.setInput('submitting', true);
    fixture.detectChanges();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ) as HTMLButtonElement[];

    expect(buttons.length).toBe(2);
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });

  it('emits the trimmed value when a valid form is submitted', () => {
    let emitted: ServiceFormValue | null = null;
    component.submitted.subscribe((value) => (emitted = value));

    component.form.controls.name.setValue('  Blood test  ');
    component.form.controls.price.setValue(10.5);
    component.form.controls.category.setValue('Diagnostics');
    component.form.controls.status.setValue('Inactive');

    component.onSubmit();

    expect(emitted).toEqual({
      name: 'Blood test',
      price: 10.5,
      category: 'Diagnostics',
      status: 'Inactive',
    });
  });

  it('does not emit and marks the form touched when submitted while invalid', () => {
    let emitted = false;
    component.submitted.subscribe(() => (emitted = true));

    component.onSubmit();

    expect(emitted).toBe(false);
    expect(component.form.controls.name.touched).toBe(true);
    expect(component.form.controls.price.touched).toBe(true);
    expect(component.form.controls.category.touched).toBe(true);
  });

  it('pre-fills the form from initialValue', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', {
      name: 'MRI',
      price: 99.99,
      category: 'Diagnostics',
      status: 'Inactive',
    });
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      name: 'MRI',
      price: 99.99,
      category: 'Diagnostics',
      status: 'Inactive',
    });
  });
});
