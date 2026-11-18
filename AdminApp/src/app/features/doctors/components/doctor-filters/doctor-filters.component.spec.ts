import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.model';
import {
  DoctorFilterState,
  EMPTY_DOCTOR_FILTERS,
} from '../../models/doctor-directory.model';
import { DoctorFiltersComponent } from './doctor-filters.component';

const NAME_OPTIONS: readonly AutocompleteOption[] = [
  { id: 'd1', label: 'Alice Brown' },
  { id: 'd2', label: 'Bob Green' },
  { id: 'd3', label: 'Cara White' },
];

const BASE_STATE: DoctorFilterState = {
  nameQuery: '',
  selectedDoctorId: '',
  specialization: '',
  officeAddress: '',
};

describe('DoctorFiltersComponent', () => {
  let fixture: ComponentFixture<DoctorFiltersComponent>;
  let component: DoctorFiltersComponent;
  let emissions: DoctorFilterState[];

  function render(
    state: DoctorFilterState = BASE_STATE,
    specializationOptions: readonly string[] = ['Cardiology', 'Neurology'],
    officeOptions: readonly string[] = ['Office A', 'Office B']
  ): void {
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('nameOptions', NAME_OPTIONS);
    fixture.componentRef.setInput('specializationOptions', specializationOptions);
    fixture.componentRef.setInput('officeOptions', officeOptions);
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function nameInput(): HTMLInputElement {
    return root().querySelector('#doctor-filter-name') as HTMLInputElement;
  }

  function typeName(value: string): void {
    nameInput().value = value;
    nameInput().dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function selectValue(id: string, value: string): void {
    const select = root().querySelector(`#${id}`) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctorFiltersComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DoctorFiltersComponent);
    component = fixture.componentInstance;
    emissions = [];
    component.filterChange.subscribe((state) => emissions.push(state));
  });

  it('lists every doctor by full name in the autocomplete', () => {
    render();

    nameInput().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    const labels = Array.from(root().querySelectorAll('li[role="option"]')).map((option) =>
      option.textContent?.trim()
    );

    expect(labels).toEqual(['Alice Brown', 'Bob Green', 'Cara White']);
  });

  it('emits the selected doctor id together with the name query', () => {
    render();

    nameInput().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    root()
      .querySelector('li[role="option"]')
      ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();

    expect(emissions).toEqual([
      { ...EMPTY_DOCTOR_FILTERS, nameQuery: 'Alice Brown', selectedDoctorId: 'd1' },
    ]);
  });

  it('clears both the selected id and the query when the name is erased', () => {
    render({ ...EMPTY_DOCTOR_FILTERS, nameQuery: 'Alice Brown', selectedDoctorId: 'd1' });

    typeName('');

    expect(emissions.at(-1)).toEqual(EMPTY_DOCTOR_FILTERS);
  });

  it('emits an empty specialization for the All option', () => {
    render({ ...EMPTY_DOCTOR_FILTERS, specialization: 'Cardiology' });

    selectValue('doctor-filter-specialization', '');

    expect(emissions.at(-1)?.specialization).toBe('');
  });

  it('emits an empty office for the All option', () => {
    render({ ...EMPTY_DOCTOR_FILTERS, officeAddress: 'Office A' });

    selectValue('doctor-filter-office', '');

    expect(emissions.at(-1)?.officeAddress).toBe('');
  });

  it('renders a disabled placeholder for a selection the narrowed options no longer offer', () => {
    render(
      { ...EMPTY_DOCTOR_FILTERS, specialization: 'Dermatology', officeAddress: 'Office A' },
      ['Cardiology'],
      ['Office A']
    );

    const placeholder = Array.from(
      root().querySelectorAll('#doctor-filter-specialization option')
    ).find((option) => option.textContent?.trim() === 'Dermatology');

    expect(placeholder?.hasAttribute('disabled')).toBe(true);
  });

  it('emits the empty state from Clear filters', () => {
    render({ ...EMPTY_DOCTOR_FILTERS, nameQuery: 'Alice', specialization: 'Cardiology' });

    const clear = Array.from(root().querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Clear filters'
    );

    clear?.click();

    expect(emissions.at(-1)).toEqual(EMPTY_DOCTOR_FILTERS);
  });

  it('never mutates the state input it receives', () => {
    const state: DoctorFilterState = Object.freeze({ ...EMPTY_DOCTOR_FILTERS });

    render(state);

    expect(() => typeName('Alice')).not.toThrow();
    expect(state).toEqual(EMPTY_DOCTOR_FILTERS);
    expect(emissions.at(-1)?.nameQuery).toBe('Alice');
  });
});
