import { describe, expect, it } from 'vitest';

import { PHOTO_INVALID_MESSAGE } from '../models/receptionist-form.model';
import { ACCEPTED_PHOTO_TYPES, MAX_PHOTO_BYTES, validatePhotoFile } from './photo-file.validator';

function file(type: string, size: number): File {
  return new File([new Uint8Array(size)], 'photo', { type });
}

describe('validatePhotoFile', () => {
  it('accepts JPEG, PNG and WebP images up to 5 MB', () => {
    expect(ACCEPTED_PHOTO_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(validatePhotoFile(file('image/jpeg', 1024))).toBeNull();
    expect(validatePhotoFile(file('image/png', 1024))).toBeNull();
    expect(validatePhotoFile(file('image/webp', MAX_PHOTO_BYTES))).toBeNull();
  });

  it('rejects an unsupported MIME type', () => {
    expect(validatePhotoFile(file('image/gif', 1024))).toBe(PHOTO_INVALID_MESSAGE);
    expect(validatePhotoFile(file('application/pdf', 1024))).toBe(PHOTO_INVALID_MESSAGE);
  });

  it('rejects a file larger than 5 MB', () => {
    expect(validatePhotoFile(file('image/png', MAX_PHOTO_BYTES + 1))).toBe(PHOTO_INVALID_MESSAGE);
  });
});
