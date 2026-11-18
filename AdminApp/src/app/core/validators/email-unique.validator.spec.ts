import { FormControl, ValidationErrors } from '@angular/forms';
import { firstValueFrom, from, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailTakenLookup, emailUniqueValidator } from './email-unique.validator';

function controlWith(value: string): FormControl<string> {
  return new FormControl<string>(value, { nonNullable: true });
}

describe('emailUniqueValidator', () => {
  let lookup: ReturnType<typeof vi.fn<EmailTakenLookup>>;

  beforeEach(() => {
    lookup = vi.fn<EmailTakenLookup>(() => of(false));
  });

  async function run(value: string): Promise<ValidationErrors | null> {
    const result = emailUniqueValidator(lookup, 0)(controlWith(value));

    return firstValueFrom(from(result));
  }

  it('accepts a free email without reporting an error', async () => {
    const result = await run('free@hospital.org');

    expect(result).toBeNull();
    expect(lookup).toHaveBeenCalledWith('free@hospital.org');
  });

  it('reports emailTaken when the lookup finds the address', async () => {
    lookup.mockReturnValue(of(true));

    await expect(run('taken@hospital.org')).resolves.toEqual({ emailTaken: true });
  });

  it('skips the lookup for empty input', async () => {
    const result = await run('   ');

    expect(result).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('fails open when the lookup errors', async () => {
    lookup.mockReturnValue(throwError(() => new Error('network down')));

    await expect(run('unknown@hospital.org')).resolves.toBeNull();
  });
});
