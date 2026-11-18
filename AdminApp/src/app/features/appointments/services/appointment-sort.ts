import { AppointmentRow } from '../models/appointment.model';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function compareInstants(left: string, right: string): number {
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return left.localeCompare(right);
  }

  return leftTime - rightTime;
}

/** `doctorFullName` is delivered as `Surname Name Middle`. */
function nameTokens(doctorFullName: string): readonly string[] {
  return doctorFullName.trim().split(/\s+/).filter((token) => token.length > 0);
}

/**
 * Ascending by start time, then doctor surname, then doctor first name, then service.
 *
 * The comparator uses one shared `Intl.Collator` (accent- and case-insensitive) and
 * relies on the stable `Array.prototype.sort`, so rows tied on every key keep the order
 * the server returned.
 */
export function sortAppointments(rows: readonly AppointmentRow[]): readonly AppointmentRow[] {
  return [...rows].sort((left, right) => {
    const byTime = compareInstants(left.startTime, right.startTime);

    if (byTime !== 0) {
      return byTime;
    }

    const leftTokens = nameTokens(left.doctorFullName);
    const rightTokens = nameTokens(right.doctorFullName);

    const bySurname = collator.compare(leftTokens[0] ?? '', rightTokens[0] ?? '');

    if (bySurname !== 0) {
      return bySurname;
    }

    const byFirstName = collator.compare(leftTokens[1] ?? '', rightTokens[1] ?? '');

    if (byFirstName !== 0) {
      return byFirstName;
    }

    return collator.compare(left.serviceName, right.serviceName);
  });
}
