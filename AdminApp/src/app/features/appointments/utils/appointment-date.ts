const CLINIC_TIME_ZONE = 'Europe/Moscow';
const clinicDateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLINIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const clinicTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLINIC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const clinicOffsetFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLINIC_TIME_ZONE,
  timeZoneName: 'longOffset',
});

/** Formats the clinic's calendar date for `input[type=date]`. */
export function toDateInputValue(date: Date): string {
  const parts = clinicDateFormat.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/** Today in the clinic's local time zone, formatted for `input[type=date]`. */
export function todayDateInputValue(reference: Date = new Date()): string {
  return toDateInputValue(reference);
}

/** The API indexes appointments by the selected calendar day at UTC midnight. */
export function toApiAppointmentDate(date: string): string {
  return `${date}T00:00:00Z`;
}

/** Converts the clinic-local slot returned by the schedule API to a UTC instant. */
export function toApiAppointmentTimeSlot(date: string, time: string): string {
  const wallTime = `${date}T${time}:00`;
  const offset = clinicOffsetFormat
    .formatToParts(new Date(`${wallTime}Z`))
    .find((part) => part.type === 'timeZoneName')?.value;
  if (offset === undefined || !offset.startsWith('GMT')) {
    throw new Error('Could not resolve the clinic time zone for this appointment.');
  }

  return new Date(`${wallTime}${offset.slice(3) || 'Z'}`).toISOString();
}

/** Formats an ISO date-time as `HH:mm` in the clinic's local time zone. */
export function toTimeLabel(isoDateTime: string): string {
  const parsed = new Date(isoDateTime);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(isoDateTime)) {
    return clinicTimeFormat.format(parsed);
  }

  const hours = `${parsed.getHours()}`.padStart(2, '0');
  const minutes = `${parsed.getMinutes()}`.padStart(2, '0');

  return `${hours}:${minutes}`;
}

/** Builds the `11:00 - 11:20` label from the server start and end instants. */
export function toTimeRangeLabel(startTime: string, endTime: string): string {
  const start = toTimeLabel(startTime);
  const end = toTimeLabel(endTime);

  if (start.length === 0 || end.length === 0) {
    return `${startTime} - ${endTime}`;
  }

  return `${start} - ${end}`;
}
