import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { readApiAcknowledgment } from '../../api/api-envelope';
import { DoctorScheduleDto } from '../../api/generated/appointments/models/doctor-schedule-dto';
import { PortalPatient } from '../../api/generated/appointments/models/portal-patient';
import { PortalResult } from '../../api/generated/appointments/models/portal-result';
import { DoctorPortalService } from '../../api/generated/appointments/services/doctor-portal.service';
import { nonBlankValidator } from '../../core/validators/non-blank.validator';
import { AppDialogService } from '../../shared/components/app-dialog/app-dialog.service';
import { photoUrl } from '../receptionists/utils/receptionist-presentation';
import { todayDateInputValue, toTimeRangeLabel } from '../appointments/utils/appointment-date';

const resultFields = [
  { name: 'complaints', label: 'Complaints' },
  { name: 'conclusion', label: 'Conclusion' },
  { name: 'recommendations', label: 'Recommendations' },
] as const;

@Component({
  selector: 'app-doctor-portal',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './doctor-portal.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorPortalPage implements OnInit {
  private readonly api = inject(DoctorPortalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogs = inject(AppDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private request = 0;
  private confirming = false;

  protected readonly page = this.route.snapshot.data['portalPage'];
  protected readonly date = signal(this.route.snapshot.queryParamMap.get('date') || todayDateInputValue());
  protected readonly visits = signal<DoctorScheduleDto[]>([]);
  protected readonly patient = signal<PortalPatient | null>(null);
  protected readonly result = signal<PortalResult | null>(null);
  protected readonly tab = signal(this.route.snapshot.queryParamMap.get('tab') === 'results' ? 'results' : 'personal');
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly fromPatient = this.route.snapshot.queryParamMap.get('from') === 'patient';
  protected readonly resultFields = resultFields;
  protected readonly photoUrl = photoUrl;
  protected readonly timeRange = toTimeRangeLabel;

  protected readonly form = inject(NonNullableFormBuilder).group({
    complaints: ['', [Validators.required, nonBlankValidator]],
    conclusion: ['', [Validators.required, nonBlankValidator]],
    recommendations: ['', [Validators.required, nonBlankValidator]],
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => void this.load());
  }

  protected async load(): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const id = this.route.snapshot.paramMap.get('id') ?? '';
      if (this.page === 'schedule') {
        const response = await firstValueFrom(this.api.doctorPortalScheduleGet$Json({ date: this.date() }));
        if (!response.isSuccess || !Array.isArray(response.data)) throw new Error('Schedule could not be read.');
        if (request === this.request) this.visits.set(response.data);
      } else if (this.page === 'patient') {
        const response = await firstValueFrom(this.api.doctorPortalPatientsPatientIdGet$Json({ patientId: id }));
        if (!response.isSuccess || !response.data?.profile || !Array.isArray(response.data.history)) {
          throw new Error('Patient information could not be read.');
        }
        if (request === this.request) {
          const history = [...response.data.history].sort((left, right) =>
            (right.date ?? '').localeCompare(left.date ?? '') ||
            (left.startTime ?? '').localeCompare(right.startTime ?? ''),
          );
          this.patient.set({ ...response.data, history });
        }
      } else {
        const response = await firstValueFrom(this.api.doctorPortalResultsAppointmentIdGet$Json({ appointmentId: id }));
        if (!response.isSuccess || !response.data?.appointmentId) throw new Error('Result could not be read.');
        if (request === this.request) {
          this.result.set(response.data);
          this.editing.set(!response.data.hasResult && response.data.canEdit === true);
          this.resetForm(response.data);
        }
      }
    } catch (error: unknown) {
      if (request === this.request) this.loadError.set(this.errorMessage(error));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  protected changeDate(event: Event): void {
    const date = (event.target as HTMLInputElement).value;
    if (!date) return;
    this.date.set(date);
    void this.load();
  }

  protected edit(result: PortalResult): void {
    if (!result.canEdit) return;
    this.resetForm(result);
    this.saveError.set(null);
    this.editing.set(true);
  }

  protected async cancel(): Promise<void> {
    if (this.confirming || this.saving()) return;
    this.confirming = true;
    try {
      if (!await this.dialogs.confirm({
        title: 'Cancel changes',
        message: 'Do you really want to cancel? Entered data will not be saved.',
        confirmText: 'Yes',
        cancelText: 'No',
      })) return;
      const result = this.result();
      if (result?.hasResult) {
        this.resetForm(result);
        this.saveError.set(null);
        this.editing.set(false);
      } else {
        await this.router.navigate(['/my-schedule'], { queryParams: { date: this.date() } });
      }
    } finally {
      this.confirming = false;
    }
  }

  protected async save(result: PortalResult): Promise<void> {
    const appointmentId = result.appointmentId;
    if (!appointmentId || !result.canEdit || this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);

    const value = this.form.getRawValue();
    const body = { complaints: value.complaints.trim(), conclusion: value.conclusion.trim(), recommendations: value.recommendations.trim() };
    try {
      const response = await firstValueFrom(result.hasResult
        ? this.api.doctorPortalResultsAppointmentIdPut$Json({ appointmentId, body })
        : this.api.doctorPortalResultsAppointmentIdPost$Json({ appointmentId, body }));
      readApiAcknowledgment(response);
      await this.load();
    } catch (error: unknown) {
      this.saveError.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private resetForm(result: PortalResult): void {
    this.form.reset({
      complaints: result.complaints ?? '',
      conclusion: result.conclusion ?? '',
      recommendations: result.recommendations ?? '',
    });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 404) return 'This record is unavailable. Check that your doctor profile is linked and the appointment is approved.';
      return error.error?.errors?.[0] || error.error?.message || 'The request could not be completed. Please try again.';
    }
    return error instanceof Error ? error.message : 'The request could not be completed.';
  }
}
