import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { WritableSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationService } from '../../../../core/services/notification.service';
import { AppDialogService } from '../../../../shared/components/app-dialog/app-dialog.service';
import { ReceptionistCreateDialogComponent } from '../../components/receptionist-create-dialog/receptionist-create-dialog.component';
import {
  CONFIRM_NO_LABEL,
  CONFIRM_YES_LABEL,
  DELETE_DIALOG_MESSAGE,
} from '../../models/receptionist-dialog.model';
import { ReceptionistRow } from '../../models/receptionist.model';
import { ReceptionistDirectoryStore } from '../../services/receptionist-directory.store';
import { ReceptionistPhotoService } from '../../services/receptionist-photo.service';
import { ReceptionistsPageComponent } from './receptionists-page.component';

const ROW: ReceptionistRow = {
  id: 'r1',
  fullName: 'Anna Smith',
  officeAddress: 'Office A',
  photoPath: 'file-1',
};

interface PageInternals {
  openCreateDialog(): void;
  openProfile(id: string): void;
  requestDelete(row: ReceptionistRow): Promise<void>;
}

describe('ReceptionistsPageComponent', () => {
  let fixture: ComponentFixture<ReceptionistsPageComponent>;
  let internals: PageInternals;

  const rows: WritableSignal<readonly ReceptionistRow[]> = signal<readonly ReceptionistRow[]>([
    ROW,
  ]);
  const isLoading = signal(false);
  const loadError = signal<string | null>(null);
  const deletingId = signal<string | null>(null);
  const deleteError = signal<string | null>(null);

  const loadAll = vi.fn(() => Promise.resolve());
  const remove = vi.fn(() => Promise.resolve(true));
  const confirm = vi.fn(() => Promise.resolve(true));
  const dialogOpen = vi.fn();
  const showSuccess = vi.fn();
  const showError = vi.fn();
  const deletePhoto = vi.fn(() => Promise.resolve());
  const navigate = vi.fn(() => Promise.resolve(true));

  beforeEach(async () => {
    rows.set([ROW]);
    isLoading.set(false);
    loadError.set(null);
    deletingId.set(null);
    deleteError.set(null);
    loadAll.mockClear();
    remove.mockReset();
    remove.mockResolvedValue(true);
    confirm.mockReset();
    confirm.mockResolvedValue(true);
    dialogOpen.mockReset();
    showSuccess.mockReset();
    showError.mockReset();
    deletePhoto.mockClear();
    navigate.mockClear();

    await TestBed.configureTestingModule({
      imports: [ReceptionistsPageComponent],
      providers: [
        {
          provide: ReceptionistDirectoryStore,
          useValue: {
            rows,
            isLoading,
            loadError,
            deletingId,
            deleteError,
            loadAll,
            delete: remove,
          },
        },
        { provide: ReceptionistPhotoService, useValue: { delete: deletePhoto } },
        { provide: Dialog, useValue: { open: dialogOpen } },
        { provide: AppDialogService, useValue: { confirm } },
        { provide: NotificationService, useValue: { showSuccess, showError } },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReceptionistsPageComponent);
    internals = fixture.componentInstance as unknown as PageInternals;
    fixture.detectChanges();
  });

  it('loads the directory on init and renders the Create action', () => {
    expect(loadAll).toHaveBeenCalledOnce();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Create receptionist');
  });

  it('navigates to the profile route', () => {
    internals.openProfile('r1');

    expect(navigate).toHaveBeenCalledWith(['/receptionists', 'r1', 'profile']);
  });

  it('opens the create dialog and refreshes after a successful creation', () => {
    dialogOpen.mockReturnValue({
      closed: of({
        created: { id: 'r2', fullName: 'Bob Jones', officeAddress: 'Office B' },
      }),
    });

    internals.openCreateDialog();

    expect(dialogOpen).toHaveBeenCalledWith(
      ReceptionistCreateDialogComponent,
      expect.objectContaining({
        disableClose: true,
        restoreFocus: true,
        autoFocus: 'first-tabbable',
      }),
    );
    expect(showSuccess).toHaveBeenCalledOnce();
    expect(loadAll).toHaveBeenCalledTimes(2);
  });

  it('does not refresh when the create dialog is cancelled', () => {
    dialogOpen.mockReturnValue({ closed: of({ created: null }) });

    internals.openCreateDialog();

    expect(showSuccess).not.toHaveBeenCalled();
    expect(loadAll).toHaveBeenCalledOnce();
  });

  it('does nothing when the delete confirmation is declined', async () => {
    confirm.mockResolvedValue(false);

    await internals.requestDelete(ROW);

    expect(confirm).toHaveBeenCalledWith({
      title: 'Delete receptionist',
      message: DELETE_DIALOG_MESSAGE,
      confirmText: CONFIRM_YES_LABEL,
      cancelText: CONFIRM_NO_LABEL,
    });
    expect(remove).not.toHaveBeenCalled();
    expect(showSuccess).not.toHaveBeenCalled();
  });

  it('deletes the row, shows a toast and cleans up the stored photo on Yes', async () => {
    await internals.requestDelete(ROW);

    expect(remove).toHaveBeenCalledWith('r1');
    expect(showSuccess).toHaveBeenCalledWith('Receptionist deleted.');
    expect(deletePhoto).toHaveBeenCalledWith('file-1');
  });

  it('keeps the row and shows an error toast when the delete fails', async () => {
    remove.mockResolvedValue(false);
    deleteError.set('Delete failed');

    await internals.requestDelete(ROW);

    expect(showError).toHaveBeenCalledWith('Delete failed');
    expect(showSuccess).not.toHaveBeenCalled();
    expect(deletePhoto).not.toHaveBeenCalled();
  });

  it('does not call the photo cleanup when the profile has no photo', async () => {
    await internals.requestDelete({ ...ROW, photoPath: null });

    expect(deletePhoto).not.toHaveBeenCalled();
  });
});
