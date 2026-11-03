import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Unsubscribe } from '@angular/fire/firestore';
import { ShareViewService } from '../../services/share-view.service';
import { ShareView } from '../../utils/share-view';
import { BrandComponent } from '../../shared/brand/brand.component';
import { AvatarGlyphComponent } from '../../shared/avatar-glyph/avatar-glyph.component';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { FirestoreResumeService } from '../../services/firestore-resume.service';

/**
 * The read-only trip page for people at home (#611): /view#<token>, no
 * account needed. Shows the copy a member shared (dates and places, the
 * plan, flights, stays by town, who's going), live, with a "Made with The
 * Itinerists" footer and a print layout for "Save as PDF".
 */
@Component({
  selector: 'app-view',
  imports: [RouterLink, BrandComponent, AvatarGlyphComponent, LoadingComponent],
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss',
})
export class ViewComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private shares = inject(ShareViewService);
  private connection = inject(FirestoreResumeService);
  readonly view = signal<ShareView | null>(null);
  readonly state = signal<'loading' | 'shown' | 'missing'>('loading');
  private unsub?: Unsubscribe;

  ngOnInit(): void {
    const token = this.route.snapshot.fragment ?? '';
    if (!/^[A-Za-z0-9]{10,40}$/.test(token)) { this.state.set('missing'); return; }
    this.unsub = this.shares.watch(token, v => { this.view.set(v); this.state.set(v ? 'shown' : 'missing'); });
  }

  ngOnDestroy(): void { this.unsub?.(); }

  /** True from the tap until the print sheet closes (#683). */
  readonly pdfBusy = signal(false);

  /**
   * Save as PDF (#683). On a phone the print sheet took a minute or more to
   * appear: Safari waits for open requests first, and the page's live
   * connection keeps one open. So the button shows it's working at once, the
   * connection is closed while the sheet opens, and it reopens afterwards.
   */
  async savePdf(): Promise<void> {
    if (this.pdfBusy()) return;
    this.pdfBusy.set(true);
    await new Promise(r => setTimeout(r, 50));   // let "Preparing PDF…" show before printing takes over
    try { await this.connection.pause(); } catch { /* print anyway */ }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      this.pdfBusy.set(false);
      void this.connection.resume().catch(() => { /* it reconnects on its own next time */ });
    };
    window.addEventListener('afterprint', finish, { once: true });
    setTimeout(finish, 120_000);   // a browser that never says the sheet closed
    window.print();
  }
}
