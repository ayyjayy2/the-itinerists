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

  it('gives both password fields an eye that shows and hides them', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const fields = () => [...el.querySelectorAll<HTMLInputElement>('.input-wrap input')];
    const eyes = () => [...el.querySelectorAll<HTMLButtonElement>('.eye-btn')];
    expect(fields().length).toBe(2);
    expect(eyes().length).toBe(2);

    eyes()[1].click();
    fixture.detectChanges();
    expect(fields().every(f => f.type === 'text')).toBeTrue();

    eyes()[1].click();
    fixture.detectChanges();
    expect(fields().every(f => f.type === 'password')).toBeTrue();
  });
});
