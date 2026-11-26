import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { OfficeStatus } from '../../../api/generated/offices/models/office-status';
import { OfficesService } from '../../../api/generated/offices/services/offices.service';
import { NotificationService } from '../../../core/services/notification.service';
import { OfficeStatusComponent } from '../components/office-status.component';
import { OfficeView, officeErrorMessage, toOfficeView } from '../models/office.model';

@Component({
  selector: 'app-offices-page',
  standalone: true,
  imports: [RouterLink, OfficeStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offices-page.component.html',
})
export class OfficesPageComponent implements OnInit {
  private readonly officesApi = inject(OfficesService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly pageSize = 20;
  protected readonly offices = signal<readonly OfficeView[]>([]);
  protected readonly page = signal(1);
  protected readonly totalCount = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly savingStatus = signal<ReadonlySet<string>>(new Set());

  ngOnInit(): void {
    void this.load(1);
  }

  protected async load(page: number): Promise<void> {
    if (this.loading() || this.savingStatus().size > 0) return;

    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(this.officesApi.officesGet({ Page: page, PageSize: this.pageSize }));
      if (!Array.isArray(result?.items) || typeof result.totalCount !== 'number') {
        throw new Error('The offices service returned an incomplete page.');
      }

      this.offices.set(result.items.map(toOfficeView));
      this.totalCount.set(result.totalCount);
      this.page.set(page);
    } catch (error: unknown) {
      this.error.set(officeErrorMessage(error, 'Could not load offices.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected openOffice(id: string): void {
    void this.router.navigate(['/offices', id]);
  }

  protected async changeStatus(office: OfficeView, status: OfficeStatus): Promise<void> {
    if (this.savingStatus().has(office.id)) return;

    this.savingStatus.update((ids) => new Set([...ids, office.id]));
    try {
      await firstValueFrom(this.officesApi.officesIdStatusPatch({ id: office.id, body: { status } }));
      this.offices.update((rows) => rows.map((row) => row.id === office.id ? { ...row, status } : row));
      this.notifications.showSuccess('Office status updated.');
    } catch (error: unknown) {
      this.notifications.showError(officeErrorMessage(error, 'Could not update the office status.'));
    } finally {
      this.savingStatus.update((ids) => new Set([...ids].filter((id) => id !== office.id)));
    }
  }
}
