import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { TripService } from './trip.service';
import { UserService } from './user.service';
import { ItineraryService } from './itinerary.service';
import { FlightsService } from './flights.service';
import { StaysService } from './stays.service';
import { DataService } from './data.service';
import { AirportZoneService } from './airport-zone.service';
import { CalEvent, buildIcs, icsFileName, tripCalendarEvents } from '../utils/calendar-export';
import { planCalendarSync, syncWindow, toNative } from '../utils/calendar-sync';

export type CalendarExportResult =
  | { kind: 'downloaded' | 'opened' | 'shared' | 'empty' }
  | { kind: 'synced'; added: number; updated: number; removed: number }
  | { kind: 'no-access' };

/**
 * "Add to calendar": one .ics file with the signed-in person's part of the
 * active trip (their itinerary items, flights, stays and transport).
 * On the web it downloads, and the phone or computer offers to add it to
 * Calendar. In the iPhone app it opens in the system preview, whose
 * "Add All" puts every event in Calendar; if that fails, the share sheet.
 */
@Injectable({ providedIn: 'root' })
export class CalendarExportService {
  private tripService = inject(TripService);
  private userService = inject(UserService);
  private itinerary = inject(ItineraryService);
  private flights = inject(FlightsService);
  private stays = inject(StaysService);
  private data = inject(DataService);
  private airports = inject(AirportZoneService);

  async export(): Promise<CalendarExportResult> {
    const trip = this.tripService.activeTrip();
    const me = this.userService.currentUser();
    if (!trip || !me?.uid) return { kind: 'empty' };
    await this.airports.whenLoaded();
    const events = tripCalendarEvents({
      trip, me: { uid: me.uid, name: me.name ?? '' },
      items: this.itinerary.items(), flights: this.flights.flights(), stays: this.stays.stays(),
      transport: (this.data.data()?.rentalCar ?? []) as never,
      airportZone: iata => this.airports.zoneFor(iata),
    });
    if (!events.length) return { kind: 'empty' };
    if (Capacitor.isNativePlatform()) return this.syncToCalendar(events, trip);
    return this.download(buildIcs(trip.name || 'Trip', events), icsFileName(trip.name || 'trip'));
  }

  /**
   * iPhone app: add the trip straight to Calendar, then open Calendar on the
   * trip's first day. Adding again updates the same events (matched by the tag
   * in their notes) instead of making copies. Without calendar access, the
   * file opens in the system preview instead.
   */
  private async syncToCalendar(events: CalEvent[], trip: { id: string; name?: string; startDate?: string; endDate?: string }): Promise<CalendarExportResult> {
    const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
    const { result: access } = await CapacitorCalendar.requestFullCalendarAccess();
    if (access !== 'granted') {
      await this.openNative(buildIcs(trip.name || 'Trip', events), icsFileName(trip.name || 'trip'), trip.name || 'Trip');
      return { kind: 'no-access' };
    }
    const natives = events.map(e => toNative(e, trip.id));
    const { result: existing } = await CapacitorCalendar.listEventsInRange(syncWindow(natives, trip));
    const plan = planCalendarSync(events, existing.map(e => ({
      id: e.id, title: e.title ?? null, startDate: e.startDate, endDate: e.endDate, isAllDay: e.isAllDay,
      location: e.location ?? null, description: e.description ?? null,
    })), trip.id);
    for (const ev of plan.create) await CapacitorCalendar.createEvent({ ...ev });
    for (const { id, event } of plan.update) await CapacitorCalendar.modifyEvent({ id, ...event });
    if (plan.remove.length) await CapacitorCalendar.deleteEventsById({ ids: plan.remove });
    await CapacitorCalendar.openCalendar({ date: Math.min(...natives.map(n => n.startDate)) }).catch(() => {/* events are in; opening is a bonus */});
    return { kind: 'synced', added: plan.create.length, updated: plan.update.length, removed: plan.remove.length };
  }

  private download(ics: string, fileName: string): CalendarExportResult {
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return { kind: 'downloaded' };
  }

  private async openNative(ics: string, fileName: string, title: string): Promise<CalendarExportResult> {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { uri } = await Filesystem.writeFile({ path: fileName, data: ics, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      const { FileOpener } = await import('@capawesome-team/capacitor-file-opener');
      await FileOpener.openFile({ path: uri, mimeType: 'text/calendar' });
      return { kind: 'opened' };
    } catch {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, url: uri, dialogTitle: 'Add to calendar' });
      return { kind: 'shared' };
    }
  }
}
