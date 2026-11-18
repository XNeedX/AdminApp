import { DoctorStatus } from './doctor-form.model';

export interface StatusPresentation {
  readonly label: string;
  readonly badgeClasses: string;
}

const STATUS_PRESENTATION: Record<DoctorStatus, StatusPresentation> = {
  [DoctorStatus.AtWork]: {
    label: DoctorStatus.AtWork,
    badgeClasses: 'bg-green-100 text-green-800',
  },
  [DoctorStatus.OnVacation]: {
    label: DoctorStatus.OnVacation,
    badgeClasses: 'bg-blue-100 text-blue-800',
  },
  [DoctorStatus.SickDay]: {
    label: DoctorStatus.SickDay,
    badgeClasses: 'bg-amber-100 text-amber-800',
  },
  [DoctorStatus.SickLeave]: {
    label: DoctorStatus.SickLeave,
    badgeClasses: 'bg-orange-100 text-orange-800',
  },
  [DoctorStatus.SelfIsolation]: {
    label: DoctorStatus.SelfIsolation,
    badgeClasses: 'bg-purple-100 text-purple-800',
  },
  [DoctorStatus.LeaveWithoutPay]: {
    label: DoctorStatus.LeaveWithoutPay,
    badgeClasses: 'bg-gray-100 text-gray-700',
  },
  [DoctorStatus.Inactive]: {
    label: DoctorStatus.Inactive,
    badgeClasses: 'bg-red-100 text-red-800',
  },
};

/** Tailwind badge classes for every status; one mapping for profile and table. */
export function statusPresentation(status: DoctorStatus): StatusPresentation {
  return STATUS_PRESENTATION[status];
}
