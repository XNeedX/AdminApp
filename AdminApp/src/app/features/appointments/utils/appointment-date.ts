/** Local `yyyy-MM-dd` formatting shared by the date field, filters and API parameters. */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** Today in the clinic's local time zone, formatted for `input[type=date]`. */
export function todayDateInputValue(reference: Date = new Date()): string {
  return toDateInputValue(reference);
}

/** Formats an ISO date-time as `HH:mm` in the clinic's local time zone. */
export function toTimeLabel(isoDateTime: string): string {
  const parsed = new Date(isoDateTime);

  if (Number.isNaN(parsed.getTime())) {
    return '';
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
