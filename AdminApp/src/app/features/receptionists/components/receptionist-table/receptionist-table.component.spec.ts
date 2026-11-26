import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ReceptionistRow } from '../../models/receptionist.model';
import { ReceptionistTableComponent } from './receptionist-table.component';

const ROWS: readonly ReceptionistRow[] = [
  { id: 'r1', fullName: 'Anna Smith', officeAddress: 'Office A', photoPath: null },
  { id: 'r2', fullName: 'Bob Jones', officeAddress: '', photoPath: 'file-1' },
];

describe('ReceptionistTableComponent', () => {
  let fixture: ComponentFixture<ReceptionistTableComponent>;

  function render(
    overrides: {
      rows?: readonly ReceptionistRow[];
      isLoading?: boolean;
      loadError?: string | null;
      deletingId?: string | null;
    } = {},
  ): void {
    fixture.componentRef.setInput('rows', overrides.rows ?? ROWS);
    fixture.componentRef.setInput('isLoading', overrides.isLoading ?? false);
    fixture.componentRef.setInput('loadError', overrides.loadError ?? null);
    fixture.componentRef.setInput('deletingId', overrides.deletingId ?? null);
    fixture.detectChanges();
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return root().textContent ?? '';
  }

  function deleteButtons(): readonly HTMLButtonElement[] {
    return Array.from(root().querySelectorAll('button')).filter(
      (button) => button.textContent?.trim() === 'Delete',
    );
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceptionistTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ReceptionistTableComponent);
  });

  it('renders exactly the two data columns and a Delete action per row', () => {
    render();

    const headers = Array.from(root().querySelectorAll('thead th')).map((header) =>
      header.textContent?.trim(),
    );

    expect(headers).toContain('Full name');
    expect(headers).toContain('Office address');
    expect(deleteButtons()).toHaveLength(ROWS.length);
    expect(text()).toContain('Anna Smith');
    expect(text()).toContain('Office A');
    expect(text()).toContain('Not assigned');
  });

  it('emits profileRequested when the full name is activated', () => {
    const requested: string[] = [];
    fixture.componentInstance.profileRequested.subscribe((id) => requested.push(id));
    render();

    const nameButton = Array.from(root().querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Anna Smith',
    );

    nameButton?.click();

    expect(requested).toEqual(['r1']);
  });

  it('renders entries without an ID and exposes actions only for entries with an ID', () => {
    const requested: string[] = [];
    fixture.componentInstance.profileRequested.subscribe((id) => requested.push(id));
    render({ rows: [{ ...ROWS[0], id: null }, ROWS[1]] });

    const firstRow = root().querySelector<HTMLTableRowElement>('tbody tr');
    expect(firstRow?.textContent).toContain('Anna Smith');
    expect(firstRow?.querySelector('button')).toBeNull();
    expect(deleteButtons()).toHaveLength(1);
    firstRow?.click();
    expect(requested).toEqual([]);
  });

  it('emits profileRequested when the profile icon is activated', () => {
    const requested: string[] = [];
    fixture.componentInstance.profileRequested.subscribe((id) => requested.push(id));
    render();

    const icon = root().querySelector<HTMLButtonElement>(
      'button[aria-label="Open profile of Bob Jones"]',
    );

    icon?.click();

    expect(requested).toEqual(['r2']);
  });

  it('emits deleteRequested without also requesting the profile', () => {
    const deleted: ReceptionistRow[] = [];
    let profileRequests = 0;
    fixture.componentInstance.deleteRequested.subscribe((row) => deleted.push(row));
    fixture.componentInstance.profileRequested.subscribe(() => {
      profileRequests += 1;
    });
    render();

    deleteButtons()[0].click();

    expect(deleted.map((row) => row.id)).toEqual(['r1']);
    expect(profileRequests).toBe(0);
  });

  it('disables Delete only for the row that is being deleted', () => {
    render({ deletingId: 'r2' });

    const first = root().querySelector<HTMLButtonElement>('button[aria-label="Delete Anna Smith"]');
    const second = root().querySelector<HTMLButtonElement>('button[aria-label="Delete Bob Jones"]');

    expect(first?.disabled).toBe(false);
    expect(second?.disabled).toBe(true);
    expect(second?.textContent?.trim()).toBe('Deleting…');
  });

  it('renders the loading state instead of the table', () => {
    render({ rows: [], isLoading: true });

    expect(text()).toContain('Loading receptionists');
    expect(root().querySelector('table')).toBeNull();
  });

  it('renders the empty state', () => {
    render({ rows: [] });

    expect(text()).toContain('No receptionists found');
    expect(root().querySelector('table')).toBeNull();
  });

  it('renders the error state and emits retryRequested', () => {
    let retries = 0;
    fixture.componentInstance.retryRequested.subscribe(() => {
      retries += 1;
    });
    render({ rows: [], loadError: 'Database unavailable' });

    expect(text()).toContain('Database unavailable');

    const retry = Array.from(root().querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Try again',
    );
    retry?.click();

    expect(retries).toBe(1);
  });
});
