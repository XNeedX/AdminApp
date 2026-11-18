import { todayDateInputValue } from '../utils/appointment-date';

/** Approval filter rendered by the status select. */
export type AppointmentStatusFilter = 'all' | 'approved' | 'notApproved';

/** Filter panel state. `hasGenerated` gates whether the table is rendered. */
export interface AppointmentFilterState {
  readonly date: string;
  readonly doctorId: string;
  readonly serviceId: string;
  readonly status: AppointmentStatusFilter;
  readonly officeId: string;
  readonly hasGenerated: boolean;
}

/** Default state of the filter panel: today, every other filter unset. */
export function createEmptyFilterState(reference: Date = new Date()): AppointmentFilterState {
  return {
    date: todayDateInputValue(reference),
    doctorId: '',
    serviceId: '',
    status: 'all',
    officeId: '',
    hasGenerated: false,
  };
}
