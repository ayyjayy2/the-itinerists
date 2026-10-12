import { Component, inject } from '@angular/core';
import { SurveyService } from '../../services/survey.service';

/**
 * The survey invitation pop-up. It lives in the app shell, so it greets
 * signed-in people on whatever page they open; closing it leaves the Home
 * banner for later visits (SurveyService).
 */
@Component({
  selector: 'app-survey-popup',
  standalone: true,
  template: `
    @if (survey.popupOpen() && survey.config(); as config) {
      <div class="modal-backdrop" (click)="survey.closePopup()">
        <div class="survey-popup" role="dialog" aria-modal="true" aria-labelledby="survey-title" (click)="$event.stopPropagation()">
          <button class="survey-close" type="button" (click)="survey.closePopup()" aria-label="Close">✕</button>
          <h2 id="survey-title">{{ config.title }}</h2>
          <p class="survey-body">{{ config.body }}</p>
          <a class="btn btn-primary" [href]="config.url" target="_blank" rel="noopener" (click)="survey.take()">Take the survey</a>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0; z-index: 300;
      display: flex; align-items: center; justify-content: center;
      padding: 1.5rem;
      background: rgba(0, 0, 0, 0.45);
    }
    .survey-popup {
      position: relative;
      width: 100%; max-width: 400px;
      display: flex; flex-direction: column; gap: 1rem;
      padding: 2rem 1.5rem 1.5rem;
      background: var(--card-bg); border: 1px solid var(--border);
      border-radius: var(--radius-lg); box-shadow: var(--shadow-md);
    }
    h2 { margin: 0; padding-right: 2rem; }
    .survey-body { margin: 0; white-space: pre-line; line-height: 1.5; }
    .btn { justify-content: center; }
    .survey-close {
      position: absolute; top: 0.25rem; right: 0.25rem;
      width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); font-size: 1rem;
    }
  `],
})
export class SurveyPopupComponent {
  readonly survey = inject(SurveyService);
}
