import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ReceptionistProfile } from '../../models/receptionist.model';
import { ReceptionistProfileViewComponent } from './receptionist-profile-view.component';

const PROFILE: ReceptionistProfile = {
  id: 'r1',
  photoPath: null,
  firstName: 'Anna',
  lastName: 'Smith',
  middleName: 'Lee',
  officeAddress: 'Office A',
};

describe('ReceptionistProfileViewComponent', () => {
  let fixture: ComponentFixture<ReceptionistProfileViewComponent>;

  function render(profile: ReceptionistProfile | null): void {
    fixture.componentRef.setInput('profile', profile);
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function button(label: string): HTMLButtonElement {
    const element = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((candidate) => candidate.textContent?.trim() === label);

    if (element === undefined) {
      throw new Error(`Button "${label}" was not rendered.`);
    }

    return element;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceptionistProfileViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ReceptionistProfileViewComponent);
  });

  it('renders the full profile with an Edit action', () => {
    render(PROFILE);

    expect(text()).toContain('Anna');
    expect(text()).toContain('Smith');
    expect(text()).toContain('Lee');
    expect(text()).toContain('Office A');
    expect(button('Edit')).not.toBeNull();
  });

  it('shows the initials placeholder when there is no photo', () => {
    render(PROFILE);

    expect((fixture.nativeElement as HTMLElement).querySelector('img')).toBeNull();
    expect(text()).toContain('AS');
  });

  it('renders the stored photo through the Gateway URL', () => {
    render({ ...PROFILE, photoPath: 'file-1' });

    const image = (fixture.nativeElement as HTMLElement).querySelector('img');

    expect(image?.getAttribute('src')).toContain('/documents/Documents/file-1');
  });

  it('shows "Not provided" for an absent middle name', () => {
    render({ ...PROFILE, middleName: null });

    expect(text()).toContain('Not provided');
  });

  it('shows "Not assigned" for a blank office', () => {
    render({ ...PROFILE, officeAddress: '' });

    expect(text()).toContain('Not assigned');
  });

  it('emits edit when the Edit action is activated', () => {
    let edits = 0;
    fixture.componentInstance.edit.subscribe(() => {
      edits += 1;
    });
    render(PROFILE);

    button('Edit').click();

    expect(edits).toBe(1);
  });
});
