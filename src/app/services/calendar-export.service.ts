import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { TripService } from './trip.service';
import { UserService } from './user.service';
import { ItineraryService } from './itinerary.service';
import { FlightsService } from './flights.service';
import { StaysService } from './stays.service';
import { DataService } from './data.service';
import { AirportZoneService } from './airport-zone.service';
import { buildIcs, icsFileName, tripCalendarEvents } from '../utils/calendar-export';

export type CalendarExportResult = 'opened' | 'downloaded' | 'shared' | 'empty';

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
    if (!trip || !me?.uid) return 'empty';
    await this.airports.whenLoaded();
    const events = tripCalendarEvents({
      trip, me: { uid: me.uid, name: me.name ?? '' },
      items: this.itinerary.items(), flights: this.flights.flights(), stays: this.stays.stays(),
      transport: (this.data.data()?.rentalCar ?? []) as never,
      airportZone: iata => this.airports.zoneFor(iata),
    });
    if (!events.length) return 'empty';
    const ics = buildIcs(trip.name || 'Trip', events);
    const fileName = icsFileName(trip.name || 'trip');
    return Capacitor.isNativePlatform() ? this.openNative(ics, fileName, trip.name) : this.download(ics, fileName);
  }

  private download(ics: string, fileName: string): CalendarExportResult {
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return 'downloaded';
  }

  private async openNative(ics: string, fileName: string, title: string): Promise<CalendarExportResult> {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { uri } = await Filesystem.writeFile({ path: fileName, data: ics, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      const { FileOpener } = await import('@capawesome-team/capacitor-file-opener');
      await FileOpener.openFile({ path: uri, mimeType: 'text/calendar' });
      return 'opened';
    } catch {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, url: uri, dialogTitle: 'Add to calendar' });
      return 'shared';
    }
  }
}
