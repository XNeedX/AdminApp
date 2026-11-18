import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpecializationListRow } from '../../models/specialization.model';
import {
  SpecializationStatusChange,
  SpecializationTableComponent,
} from './specialization-table.component';

const ROWS: readonly SpecializationListRow[] = [
  { id: 'id-1', name: 'Cardiology', status: 'Active' },
  { id: 'id-2', name: 'Neurology', status: 'Inactive' },
];

describe('SpecializationTableComponent', () => {
  let fixture: ComponentFixture<SpecializationTableComponent>;
  let component: SpecializationTableComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpecializationTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SpecializationTableComponent);
    component = fixture.componentInstance;
  });

  function render(): void {
    fixture.componentRef.setInput('rows', ROWS);
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function bodyRows(): HTMLTableRowElement[] {
    return Array.from(host().querySelectorAll('tbody tr')) as HTMLTableRowElement[];
  }

  function radiosOf(row: HTMLTableRowElement): HTMLInputElement[] {
    return Array.from(row.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
  }

  function labelOf(radio: HTMLInputElement): string {
    return radio.closest('label')?.textContent?.trim() ?? '';
  }

  it('renders exactly the two required columns in order', () => {
    render();

    const headers = Array.from(host().querySelectorAll('thead th')).map((th) =>
      th.textContent?.trim(),
    );

    expect(headers).toEqual(['Specialization Name', 'Status']);
  });

  it('renders one Active/Inactive radio group per row with the stored value checked', () => {
    render();

    const rows = bodyRows();

    expect(rows.length).toBe(2);

    for (const [index, row] of rows.entries()) {
      const radios = radiosOf(row);

      expect(radios.length).toBe(2);
      expect(radios.map(labelOf)).toEqual(['Active', 'Inactive']);
      expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);

      const checked = radios.filter((radio) => radio.checked);

      expect(checked.length).toBe(1);
      expect(labelOf(checked[0])).toBe(ROWS[index]?.status);
    }

    expect(radiosOf(rows[0]!)[0]?.name).not.toBe(radiosOf(rows[1]!)[0]?.name);
  });

  it('emits open with the row id when the name is activated', () => {
    render();

    let openedId: string | null = null;
    component.open.subscribe((id) => (openedId = id));

    const nameButton = host().querySelector('tbody tr button') as HTMLButtonElement;
    nameButton.click();

    expect(openedId).toBe('id-1');
  });

  it('emits open when the row is activated outside the status cell', () => {
    render();

    let openedId: string | null = null;
    component.open.subscribe((id) => (openedId = id));

    const firstCell = bodyRows()[1]?.querySelector('td') as HTMLTableCellElement;
    firstCell.click();

    expect(openedId).toBe('id-2');
  });

  it('keeps status changes independent from row activation', () => {
    render();

    let openedId: string | null = null;
    let change: SpecializationStatusChange | null = null;
    component.open.subscribe((id) => (openedId = id));
    component.statusChange.subscribe((value) => (change = value));

    const inactive = radiosOf(bodyRows()[0]!).find((radio) => labelOf(radio) === 'Inactive');
    inactive?.click();

    expect(change).toEqual({ id: 'id-1', status: 'Inactive' });
    expect(openedId).toBeNull();
  });

  it('disables only the radios of the row that is saving', () => {
    fixture.componentRef.setInput('rows', ROWS);
    fixture.componentRef.setInput('statusSavingId', 'id-1');
    fixture.detectChanges();

    const firstRow = bodyRows()[0]!;
    const secondRow = bodyRows()[1]!;

    expect(radiosOf(firstRow).every((radio) => radio.disabled)).toBe(true);
    expect(radiosOf(secondRow).some((radio) => radio.disabled)).toBe(false);
  });
});
