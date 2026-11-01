import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Unsubscribe } from '@angular/fire/firestore';
import { ShareViewService } from '../../services/share-view.service';
import { ShareView } from '../../utils/share-view';
import { BrandComponent } from '../../shared/brand/brand.component';
import { AvatarGlyphComponent } from '../../shared/avatar-glyph/avatar-glyph.component';
import { LoadingComponent } from '../../shared/loading/loading.component';

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
  readonly view = signal<ShareView | null>(null);
  readonly state = signal<'loading' | 'shown' | 'missing'>('loading');
  private unsub?: Unsubscribe;

  ngOnInit(): void {
    const token = this.route.snapshot.fragment ?? '';
    if (!/^[A-Za-z0-9]{10,40}$/.test(token)) { this.state.set('missing'); return; }
    this.unsub = this.shares.watch(token, v => { this.view.set(v); this.state.set(v ? 'shown' : 'missing'); });
  }

  ngOnDestroy(): void { this.unsub?.(); }

  savePdf(): void { window.print(); }
}
