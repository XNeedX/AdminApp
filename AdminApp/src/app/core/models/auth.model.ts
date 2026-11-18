/**
 * Client-side authentication model.
 *
 * All shapes consumed from Keycloak or the Gateway are declared here and validated with
 * runtime type guards before use — external data is never trusted.
 */

export const AUTH_SESSION_STORAGE_KEY = 'adminapp.auth.session';

/** Authenticated state persisted for the browser tab. */
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

/** Roles allowed to use the admin application. */
export type AuthRole = 'Doctor' | 'Receptionist';

export const STAFF_ROLES: readonly AuthRole[] = ['Doctor', 'Receptionist'];

/** Identity derived from the access token; never persisted separately. */
export interface AuthenticatedUser {
  accountId: string;
  email: string;
  roles: readonly AuthRole[];
}

/** Backend doctor status vocabulary (see `DoctorProfile.Status`). */
export type ProfileStatus =
  | 'At work'
  | 'On vacation'
  | 'Sick Day'
  | 'Sick Leave'
  | 'Self-isolation'
  | 'Leave without pay'
  | 'Inactive';

export const PERMITTED_PROFILE_STATUSES: readonly ProfileStatus[] = [
  'At work',
  'On vacation',
  'Sick Day',
  'Sick Leave',
  'Self-isolation',
  'Leave without pay',
];

/** Claims extracted from the access token payload. */
export interface JwtClaims {
  sub: string;
  email: string;
  roles: readonly string[];
}

/** Raw Keycloak token endpoint success payload. */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
}

/** Raw Keycloak token endpoint error payload. */
export interface TokenErrorResponse {
  error: string;
  error_description?: string;
}

/** Proposed profile lookup payload (see `contracts/profiles-sign-in.contract.md`). */
export interface ProfileStatusResponse {
  id: string;
  accountId: string;
  email: string;
  status: string | null;
}

/** Proposed e-mail existence payload (see `contracts/profiles-sign-in.contract.md`). */
export interface EmailExistsResponse {
  exists: boolean;
}

export type SignInFailureReason = 'invalid' | 'unavailable';

export type SignInOutcome = { success: true } | { success: false; reason: SignInFailureReason };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isAuthRole(value: unknown): value is AuthRole {
  return value === 'Doctor' || value === 'Receptionist';
}

export function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value['accessToken'] === 'string' &&
    value['accessToken'].length > 0 &&
    typeof value['refreshToken'] === 'string' &&
    typeof value['expiresAt'] === 'number' &&
    Number.isFinite(value['expiresAt'])
  );
}

export function isTokenResponse(value: unknown): value is TokenResponse {
  if (!isRecord(value)) {
    return false;
  }

  const accessToken = value['access_token'];
  const expiresIn = value['expires_in'];
  const tokenType = value['token_type'];
  const refreshToken = value['refresh_token'];

  return (
    typeof accessToken === 'string' &&
    accessToken.length > 0 &&
    typeof expiresIn === 'number' &&
    Number.isFinite(expiresIn) &&
    expiresIn > 0 &&
    (tokenType === undefined || tokenType === 'Bearer') &&
    (refreshToken === undefined || typeof refreshToken === 'string')
  );
}

export function isTokenErrorResponse(value: unknown): value is TokenErrorResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value['error'] === 'string' &&
    (value['error_description'] === undefined || typeof value['error_description'] === 'string')
  );
}

export function isProfileStatusResponse(value: unknown): value is ProfileStatusResponse {
  if (!isRecord(value)) {
    return false;
  }

  const status = value['status'];

  return (
    typeof value['id'] === 'string' &&
    typeof value['accountId'] === 'string' &&
    typeof value['email'] === 'string' &&
    (status === undefined || status === null || typeof status === 'string')
  );
}

export function isEmailExistsResponse(value: unknown): value is EmailExistsResponse {
  return isRecord(value) && typeof value['exists'] === 'boolean';
}

/**
 * Permission rule for AC-4/AC-5: only the permitted statuses allow work.
 * A missing status is allowed because receptionists have no status column.
 * Unknown values fail closed.
 */
export function isPermittedProfileStatus(status: string | null | undefined): boolean {
  if (status === null || status === undefined) {
    return true;
  }

  return (PERMITTED_PROFILE_STATUSES as readonly string[]).includes(status);
}

/**
 * Decodes the JWT payload for display and routing purposes only.
 * The signature is validated by the Gateway, never by the SPA.
 * Returns `null` for anything malformed — never throws.
 */
export function parseJwtClaims(token: string): JwtClaims | null {
  const segments = token.split('.');
  if (segments.length < 2) {
    return null;
  }

  const payload = decodeBase64UrlJson(segments[1]);
  if (!isRecord(payload)) {
    return null;
  }

  const sub = payload['sub'];
  if (typeof sub !== 'string' || sub.length === 0) {
    return null;
  }

  const emailClaim = payload['email'];
  const usernameClaim = payload['preferred_username'];
  const email =
    typeof emailClaim === 'string' && emailClaim.length > 0
      ? emailClaim
      : typeof usernameClaim === 'string' && usernameClaim.length > 0
        ? usernameClaim
        : null;

  if (email === null) {
    return null;
  }

  return { sub, email, roles: extractRealmRoles(payload['realm_access']) };
}

function extractRealmRoles(realmAccess: unknown): readonly string[] {
  if (!isRecord(realmAccess)) {
    return [];
  }

  const roles = realmAccess['roles'];
  if (!Array.isArray(roles)) {
    return [];
  }

  return roles.filter((role): role is string => typeof role === 'string');
}

function decodeBase64UrlJson(segment: string): unknown {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const paddingLength = (4 - (normalized.length % 4)) % 4;
    const binary = atob(normalized + '='.repeat(paddingLength));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return null;
  }
}
