import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, query, where } from '@angular/fire/firestore';
import { Capacitor } from '@capacitor/core';
import { UserService } from './user.service';
import {
  AccommodationDoc, Expense, FinanceEntryDoc, FlightDoc, ItineraryItemDoc, OutfitEntry, PackingItem, TripDoc, TripMember, UserTripsDoc,
} from '../models/trip.models';
import { ExportTrip, buildDataExport, dataExportFileName } from '../utils/data-export';

/**
 * "Download my data" on Profile (#332). Reads, once, everything the person
 * may read about themselves (no listeners), builds the file
 * (utils/data-export.ts) and hands it over: a download on the web, the share
 * sheet in the iPhone app ("Save to Files", AirDrop, mail…).
 */
@Injectable({ providedIn: 'root' })
export class DataExportService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private userService = inject(UserService);

  async download(): Promise<void> {
    const profile = this.userService.firestoreUser();
    if (!profile) throw new Error('Sign in to download your data.');
    const uid = profile.uid;
    const now = Date.now();
    const data = await runInInjectionContext(this.injector, async () => {
      const read = async <T>(path: string[]) => {
        const snap = await getDocs(collection(this.firestore, path[0], ...path.slice(1)));
        return snap.docs.map(d => ({ ...d.data(), id: d.id }) as T);
      };
      const expenses = (await getDoc(doc(this.firestore, 'userExpenses', uid))).data()?.['items'] as Expense[] | undefined;
      const tripIds = ((await getDoc(doc(this.firestore, 'userTrips', uid))).data() as UserTripsDoc | undefined)?.tripIds ?? [];
      const trips = (await Promise.all(tripIds.map(async (id): Promise<ExportTrip | null> => {
        const tripSnap = await getDoc(doc(this.firestore, 'trips', id)).catch(() => null);
        if (!tripSnap?.exists()) return null;            // a trip they've left or that was removed
        const members = await read<TripMember>(['trips', id, 'members']);
        const [itinerary, flights, stays, finance, outfits] = await Promise.all([
          read<ItineraryItemDoc>(['trips', id, 'itinerary']),
          read<FlightDoc>(['trips', id, 'flights']),
          read<AccommodationDoc>(['trips', id, 'stays']),
          read<FinanceEntryDoc>(['trips', id, 'finance']),
          read<OutfitEntry>(['trips', id, 'outfits']),
        ]);
        const packing = ((await getDoc(doc(this.firestore, 'trips', id, 'packing', uid)).catch(() => null))?.data()?.['items'] ?? []) as PackingItem[];
        // Photos are private to their owner: the rules only allow asking for your own.
        const photos = (await getDocs(query(collection(this.firestore, 'trips', id, 'outfitPhotos'), where('ownerUid', '==', uid))).catch(() => null))
          ?.docs.map(d => ({ id: d.id, date: d.data()['date'] as string, dataUrl: d.data()['dataUrl'] as string | undefined })) ?? [];
        return {
          trip: { ...(tripSnap.data() as TripDoc), id }, me: members.find(m => m.uid === uid) ?? null, members,
          itinerary, flights, stays, finance, packing, outfits, photos,
        };
      }))).filter((t): t is ExportTrip => !!t);
      return buildDataExport({ now, uid, profile, myExpenses: expenses ?? [], trips });
    });
    const json = JSON.stringify(data, null, 2);
    const fileName = dataExportFileName(now);
    if (Capacitor.isNativePlatform()) await this.shareNative(json, fileName);
    else this.downloadWeb(json, fileName);
  }

  private downloadWeb(json: string, fileName: string): void {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  private async shareNative(json: string, fileName: string): Promise<void> {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { uri } = await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    const { Share } = await import('@capacitor/share');
    await Share.share({ title: 'Your data from The Itinerists', url: uri, dialogTitle: 'Save your data' });
  }
}
