/**
 * Narrowing helpers for the `{ isSuccess, message, errors, data }` envelope that every
 * backend microservice returns.
 *
 * Generated clients type the body as an interface whose fields are all optional, so a
 * response that does not match the contract would otherwise leak into feature code as
 * `undefined`. `readApiEnvelope` accepts `unknown`, validates the envelope and the
 * payload with a type guard, and throws `ApiContractError` when the shape is unexpected.
 * No `any`, no casts.
 */

/** Validated envelope shape shared by every microservice. */
export interface ApiEnvelope<T> {
  readonly isSuccess: boolean;
  readonly message: string | null;
  readonly errors: readonly string[];
  readonly data: T | null;
}

/** Raised when a response does not match the envelope or the expected payload shape. */
export class ApiContractError extends Error {
  readonly problems: readonly string[];

  constructor(message: string, problems: readonly string[] = []) {
    super(message);
    this.name = 'ApiContractError';
    this.problems = problems;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readErrors(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readFailureMessage(message: unknown, errors: readonly string[]): string {
  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }

  return errors[0] ?? 'The server reported an unsuccessful response.';
}

function assertSuccessful(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    throw new ApiContractError('The API response is not an object.');
  }

  const isSuccess = payload['isSuccess'];

  if (isSuccess !== true) {
    const errors = readErrors(payload['errors']);
    throw new ApiContractError(readFailureMessage(payload['message'], errors), errors);
  }

  return payload;
}

/**
 * Validates an envelope that carries data and returns the narrowed payload.
 *
 * @param payload Raw body returned by a generated client.
 * @param guard Type guard for the `data` member.
 */
export function readApiEnvelope<T>(
  payload: unknown,
  guard: (value: unknown) => value is T
): T {
  const envelope = assertSuccessful(payload);
  const data = envelope['data'];

  if (!guard(data)) {
    throw new ApiContractError('The API returned an unexpected payload shape.');
  }

  return data;
}

/** Validates an envelope that carries no data (command acknowledgements). */
export function readApiAcknowledgment(payload: unknown): void {
  assertSuccessful(payload);
}

/** Reads an optional string from an unknown record. */
export function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
