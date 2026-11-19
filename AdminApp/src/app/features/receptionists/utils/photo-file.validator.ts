import { PHOTO_INVALID_MESSAGE } from '../models/receptionist-form.model';

/** Accepted image MIME types for a receptionist photo. */
export const ACCEPTED_PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

/** Maximum accepted photo size (5 MB). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Validates a locally selected photo.
 *
 * @returns the exact inline message when the file is rejected, `null` when accepted.
 */
export function validatePhotoFile(file: File): string | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
    return PHOTO_INVALID_MESSAGE;
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return PHOTO_INVALID_MESSAGE;
  }

  return null;
}
