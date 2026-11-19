import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { readApiAcknowledgment, readApiEnvelope } from '../../../api/api-envelope';
import { DocumentsService } from '../../../api/generated/documents/services/documents.service';
import { photoUrl } from '../utils/receptionist-presentation';
import { isFileId } from './receptionist-contract.guards';

/**
 * Photo transport for receptionist profiles.
 *
 * Wraps the generated Documents client so feature code never touches `HttpClient`,
 * URLs, or multipart details directly.
 */
@Injectable({ providedIn: 'root' })
export class ReceptionistPhotoService {
  private readonly documents = inject(DocumentsService);

  /** Uploads one image and returns the stored Documents id. */
  async upload(file: File): Promise<string> {
    const payload = await firstValueFrom(this.documents.documentsPost({ body: { file } }));
    return readApiEnvelope(payload, isFileId);
  }

  /** Deletes a stored image; used as best-effort cleanup after profile changes. */
  async delete(id: string): Promise<void> {
    const payload = await firstValueFrom(this.documents.documentsIdDelete({ id }));
    readApiAcknowledgment(payload);
  }

  /** Resolves a stored id to the Gateway image URL. */
  url(photoPath: string | null): string | null {
    return photoUrl(photoPath);
  }
}
