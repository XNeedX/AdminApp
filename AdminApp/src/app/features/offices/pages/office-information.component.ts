import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { readApiEnvelope } from '../../../api/api-envelope';
import { ApiConfiguration as DocumentsConfiguration } from '../../../api/generated/documents/api-configuration';
import { DocumentsService } from '../../../api/generated/documents/services/documents.service';
import { OfficeStatus } from '../../../api/generated/offices/models/office-status';
import { OfficesService } from '../../../api/generated/offices/services/offices.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AppDialogService } from '../../../shared/components/app-dialog/app-dialog.service';
import { OfficeFormComponent } from '../components/office-form.component';
import { OfficeStatusComponent } from '../components/office-status.component';
import { OfficeView, officeErrorMessage, toOfficeView } from '../models/office.model';

const CANCEL_MESSAGE = 'Do you really want to cancel? Entered data will not be saved.';
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const REQUIRED_TEXT = [Validators.required, Validators.pattern(/\S/)];

@Component({
  selector: 'app-office-information',
  standalone: true,
  imports: [RouterLink, OfficeFormComponent, OfficeStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './office-information.component.html',
})
export class OfficeInformationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly officesApi = inject(OfficesService);
  private readonly documents = inject(DocumentsService);
  private readonly documentsConfig = inject(DocumentsConfiguration);
  private readonly dialogs = inject(AppDialogService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);

  private readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly creating = this.id === null;
  protected readonly office = signal<OfficeView | null>(null);
  protected readonly editing = signal(this.creating);
  protected readonly loading = signal(!this.creating);
  protected readonly saving = signal(false);
  protected readonly statusSaving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly photoError = signal<string | null>(null);

  private readonly preview = signal<string | null>(null);
  private readonly removeSavedPhoto = signal(false);
  private selectedPhoto: File | null = null;
  private uploadedPhoto: { readonly file: File; readonly id: string } | null = null;

  protected readonly viewPhoto = computed(() => this.documentUrl(this.office()?.photoPath));
  protected readonly formPhoto = computed(() =>
    this.preview() ?? (this.removeSavedPhoto() ? null : this.viewPhoto()),
  );

  protected readonly form = this.fb.group({
    city: this.fb.control('', REQUIRED_TEXT),
    street: this.fb.control('', REQUIRED_TEXT),
    houseNumber: this.fb.control('', REQUIRED_TEXT),
    officeNumber: this.fb.control('', REQUIRED_TEXT),
    registryDigits: this.fb.control('', [Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]),
    status: this.fb.control<OfficeStatus>(OfficeStatus.Active),
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearPreview());
  }

  ngOnInit(): void {
    void this.loadOffice();
  }

  protected async loadOffice(): Promise<void> {
    if (this.id === null) return;

    this.loading.set(true);
    this.loadError.set(null);
    try {
      const response = await firstValueFrom(this.officesApi.officesIdGet({ id: this.id }));
      this.office.set(toOfficeView(response));
    } catch (error: unknown) {
      this.loadError.set(officeErrorMessage(error, 'Could not load office information.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected startEditing(office: OfficeView): void {
    this.resetPhoto();
    this.saveError.set(null);
    this.form.reset({
      city: office.city,
      street: office.street,
      houseNumber: office.houseNumber,
      officeNumber: office.officeNumber,
      registryDigits: office.registryPhoneNumber.replace(/^\+/, ''),
      status: office.status,
    });
    this.editing.set(true);
  }

  protected choosePhoto(file: File): void {
    if (!PHOTO_TYPES.includes(file.type) || file.size === 0 || file.size > MAX_PHOTO_BYTES) {
      this.photoError.set('Choose a JPEG, PNG or WebP image up to 5 MB.');
      return;
    }

    this.clearPreview();
    this.selectedPhoto = file;
    this.preview.set(URL.createObjectURL(file));
    this.photoError.set(null);
  }

  protected removePhoto(): void {
    this.clearPreview();
    this.selectedPhoto = null;
    this.photoError.set(null);
    this.removeSavedPhoto.set(true);
  }

  protected async cancel(): Promise<void> {
    if (this.saving()) return;

    const confirmed = await this.dialogs.confirm({
      title: 'Cancel',
      message: CANCEL_MESSAGE,
      confirmText: 'Yes',
      cancelText: 'No',
    });
    if (!confirmed) return;

    this.resetPhoto();
    if (this.creating) {
      await this.router.navigate(['/offices']);
    } else {
      this.editing.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.saving() || this.photoError() !== null) return;

    this.saving.set(true);
    this.saveError.set(null);
    let newUploadId: string | null = null;
    try {
      const value = this.form.getRawValue();
      const previousUpload = this.uploadedPhoto;
      const photoPath = await this.photoPathForSave();
      if (this.uploadedPhoto !== previousUpload) {
        newUploadId = this.uploadedPhoto?.id ?? null;
      }
      const body = {
        city: value.city.trim(),
        street: value.street.trim(),
        houseNumber: value.houseNumber.trim(),
        officeNumber: value.officeNumber.trim(),
        registryPhoneNumber: `+${value.registryDigits}`,
        status: value.status,
        photoPath,
      };
      if (this.id === null) {
        await firstValueFrom(this.officesApi.officesPost({ body }));
        this.notifications.showSuccess('Office created.');
        await this.router.navigate(['/offices']);
      } else {
        const response = await firstValueFrom(this.officesApi.officesIdPut({ id: this.id, body }));
        this.office.set(toOfficeView(response));
        this.resetPhoto();
        this.editing.set(false);
        this.notifications.showSuccess('Office updated.');
      }
    } catch (error: unknown) {
      this.saveError.set(officeErrorMessage(error, 'Could not save the office.'));
      if (newUploadId !== null && error instanceof HttpErrorResponse && error.status === 400) {
        this.uploadedPhoto = null;
        await firstValueFrom(this.documents.documentsIdDelete({ id: newUploadId })).catch(() => undefined);
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected async changeStatus(office: OfficeView, status: OfficeStatus): Promise<void> {
    if (this.statusSaving()) return;

    this.statusSaving.set(true);
    try {
      await firstValueFrom(this.officesApi.officesIdStatusPatch({ id: office.id, body: { status } }));
      this.office.set({ ...office, status });
      this.notifications.showSuccess('Office status updated.');
    } catch (error: unknown) {
      this.notifications.showError(officeErrorMessage(error, 'Could not update the office status.'));
    } finally {
      this.statusSaving.set(false);
    }
  }

  private documentUrl(id: string | null | undefined): string | null {
    return id
      ? this.documentsConfig.rootUrl + DocumentsService.DocumentsIdGetPath.replace('{id}', encodeURIComponent(id))
      : null;
  }

  private async photoPathForSave(): Promise<string | null> {
    const file = this.selectedPhoto;
    if (file === null) return this.removeSavedPhoto() ? null : this.office()?.photoPath ?? null;
    if (this.uploadedPhoto?.file === file) return this.uploadedPhoto.id;

    const response = await firstValueFrom(this.documents.documentsPost({ body: { file } }));
    const id = readApiEnvelope(response, (value): value is string => typeof value === 'string' && value.length > 0);
    this.uploadedPhoto = { file, id };
    return id;
  }

  private resetPhoto(): void {
    this.clearPreview();
    this.selectedPhoto = null;
    this.uploadedPhoto = null;
    this.removeSavedPhoto.set(false);
    this.photoError.set(null);
  }

  private clearPreview(): void {
    const preview = this.preview();
    if (preview !== null) URL.revokeObjectURL(preview);
    this.preview.set(null);
  }
}
