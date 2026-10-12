import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupComponent } from './signup.component';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { LocalCacheService } from '../../services/local-cache.service';

describe('SignupComponent show-password eye', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SignupComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: LocalCacheService, useValue: { recoverIfBroken: () => false } },
      ],
    });
  });

  it('gives each password field its own eye: tapping one shows only that field', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const fields = () => [...el.querySelectorAll<HTMLInputElement>('.input-wrap input')];
    const eyes = () => [...el.querySelectorAll<HTMLButtonElement>('.eye-btn')];
    expect(fields().length).toBe(2);
    expect(eyes().length).toBe(2);

    eyes()[0].click();
    fixture.detectChanges();
    expect(fields().map(f => f.type)).toEqual(['text', 'password']);

    eyes()[1].click();
    fixture.detectChanges();
    expect(fields().map(f => f.type)).toEqual(['text', 'text']);

    eyes()[0].click();
    fixture.detectChanges();
    expect(fields().map(f => f.type)).toEqual(['password', 'text']);
    expect(eyes().map(e => e.getAttribute('aria-label'))).toEqual(['Show password', 'Hide password']);
  });
});
