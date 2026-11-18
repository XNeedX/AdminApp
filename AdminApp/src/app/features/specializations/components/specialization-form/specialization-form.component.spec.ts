import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';

import { SpecializationFormValue, SpecializationView } from '../../models/specialization.model';
import { ServiceRowControls, createServiceRow } from '../../models/specialization-form.model';
import { SpecializationFormComponent } from './specialization-form.component';

function initialView(): SpecializationView {
  return {
    id: 'spec-id',
    name: 'Cardiology',
    status: 'Active',
    services: [
      {
        id: 'service-1',
        name: 'Blood test',
        price: 12.5,
        status: 'Inactive',
        category: 'Analyses',
      },
    ],
  };
}

describe('SpecializationFormComponent', () => {
  let fixture: ComponentFixture<SpecializationFormComponent>;
  let component: SpecializationFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpecializationFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SpecializationFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function submitButton(): HTMLButtonElement {
    return host().querySelector('button[type="submit"]') as HTMLButtonElement;
  }

  function buttonsByText(label: string): HTMLButtonElement[] {
    return Array.from(host().querySelectorAll('button')).filter(
      (button) => button.textContent?.trim() === label,
    );
  }

  function rowAt(index: number): FormGroup<ServiceRowControls> {
    return component.form.controls.services.at(index);
  }

  function addValidRow(): void {
    component.addService();
    const row = rowAt(component.form.controls.services.length - 1);
    row.controls.name.setValue('Blood test');
    row.controls.price.setValue(10);
    row.controls.category.setValue('Analyses');
  }

  it('starts with an empty services array and a disabled submit action', () => {
    expect(component.form.controls.services.length).toBe(0);
    expect(component.canSubmit()).toBe(false);
    expect(submitButton().disabled).toBe(true);
  });

  it('appends a row defaulting to Active with empty name, price and category', () => {
    component.addService();
    fixture.detectChanges();

    const row = rowAt(0);

    expect(component.form.controls.services.length).toBe(1);
    expect(row.controls.name.value).toBe('');
    expect(row.controls.price.value).toBeNull();
    expect(row.controls.category.value).toBe('');
    expect(row.controls.status.value).toBe('Active');
    expect(row.controls.id.value).toBeNull();
  });

  it('removes a row with discardRow', () => {
    component.addService();
    component.addService();

    expect(component.form.controls.services.length).toBe(2);

    component.discardRow(0);
    fixture.detectChanges();

    expect(component.form.controls.services.length).toBe(1);
  });

  it('treats a whitespace-only name as empty and keeps Confirm disabled', () => {
    addValidRow();
    component.form.controls.name.setValue('   ');
    component.form.controls.name.markAsTouched();
    fixture.detectChanges();

    expect(component.nameMessage()).toBe('Please, enter the name');
    expect(component.canSubmit()).toBe(false);
    expect(submitButton().disabled).toBe(true);
  });

  it('shows the invalid-price message for zero, negative and non-numeric prices', () => {
    addValidRow();
    component.form.controls.name.setValue('Cardiology');

    const price = rowAt(0).controls.price;

    for (const value of [0, -1, 'abc' as unknown as number]) {
      price.setValue(value);
      price.markAsTouched();
      expect(component.priceMessage(rowAt(0))).toBe("You've entered an invalid price");
    }

    price.setValue(12.34);
    expect(component.priceMessage(rowAt(0))).toBeNull();
  });

  it('shows the required-price message when the price is empty', () => {
    addValidRow();
    const row = rowAt(0);

    row.controls.price.setValue(null);
    row.controls.price.markAsTouched();

    expect(component.priceMessage(row)).toBe('Please, enter the price');
  });

  it('shows the category message when no category is chosen', () => {
    addValidRow();
    const row = rowAt(0);

    row.controls.category.setValue('');
    row.controls.category.markAsTouched();

    expect(component.categoryMessage(row)).toBe('Please, choose the service category');
    expect(component.canSubmit()).toBe(false);
  });

  it('emits the trimmed value with narrowed price and category', () => {
    let emitted: SpecializationFormValue | null = null;
    component.submitted.subscribe((value) => (emitted = value));

    component.form.controls.name.setValue('  Cardiology  ');
    component.addService();

    const row = rowAt(0);
    row.controls.name.setValue('  Blood test  ');
    row.controls.price.setValue(12.34);
    row.controls.category.setValue('Diagnostics');
    row.controls.status.setValue('Inactive');

    component.onSubmit();

    expect(emitted).toEqual({
      name: 'Cardiology',
      status: 'Active',
      services: [
        {
          key: expect.any(String),
          id: null,
          name: 'Blood test',
          price: 12.34,
          status: 'Inactive',
          category: 'Diagnostics',
        },
      ],
    });
  });

  it('does not emit and marks the form touched when submitted while invalid', () => {
    let emitted = false;
    component.submitted.subscribe(() => (emitted = true));

    component.onSubmit();

    expect(emitted).toBe(false);
    expect(component.form.controls.name.touched).toBe(true);
  });

  it('pre-fills the form from initialValue in edit mode', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', initialView());
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      name: 'Cardiology',
      status: 'Active',
      services: [
        {
          key: expect.any(String),
          id: 'service-1',
          name: 'Blood test',
          price: 12.5,
          status: 'Inactive',
          category: 'Analyses',
        },
      ],
    });
    expect(submitButton().textContent?.trim()).toBe('Save changes');
  });

  it('offers Discard only for rows that are not stored yet', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', initialView());
    fixture.detectChanges();

    expect(component.isStoredRow(rowAt(0))).toBe(true);
    expect(buttonsByText('Discard').length).toBe(0);

    component.addService();
    fixture.detectChanges();

    expect(component.isStoredRow(rowAt(1))).toBe(false);
    expect(buttonsByText('Discard').length).toBe(1);
  });

  it('disables "Save changes" when the last row is removed', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', initialView());
    fixture.detectChanges();

    expect(component.canSubmit()).toBe(true);

    component.discardRow(0);
    fixture.detectChanges();

    expect(component.form.controls.services.length).toBe(0);
    expect(component.canSubmit()).toBe(false);
    expect(submitButton().disabled).toBe(true);
  });

  it('creates a discardable row that is not confused with a stored one', () => {
    const row = createServiceRow();

    expect(row.controls.id.value).toBeNull();
    expect(component.isStoredRow(row)).toBe(false);
  });
});
