# Project Learnings

## Firestore & Offline Data Persistence

When using Firestore, writes go directly to the network — there is no offline queue by default.
If the device loses connection mid-save, the write silently fails and the data only exists in memory.
When the app is closed or refreshed, that in-memory data is gone.

**Fix: enable offline persistence + maintain a local backup**

1. Enable Firestore's IndexedDB cache so writes are queued locally and synced once back online:
   ```ts
   // app.config.ts
   provideFirestore(() => initializeFirestore(getApp(), {
     localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
   }))
   ```

2. In the service, write a localStorage backup **immediately** on every save — not just after Firestore
   confirms. On init, if Firestore is unreachable, fall back to that backup instead of showing nothing.
   If the Firestore document doesn't exist, seed it from the backup:
   ```ts
   private save(items: Expense[]): void {
     this.writeBackup(backupKey, items);          // always write immediately
     setDoc(docRef, { items })
       .catch(err => console.error('[Expenses] Failed to save:', err));
   }

   // In init(), if no Firestore doc exists:
   const seed = localItems.length > 0 ? localItems : backupItems;
   if (seed.length > 0) setDoc(docRef, { items: seed });

   // In the snapshot error handler:
   const fallback = backupItems.length > 0 ? backupItems : localItems;
   this._expenses.set(fallback);
   ```

   > **Important:** originally the backup was only written in the `.then()` callback, meaning it was
   > only updated after Firestore confirmed the write. If Firestore errored, new additions were never
   > captured in the backup. Writing immediately on every change fixes this.

3. Add `.catch()` to every `setDoc` / `updateDoc` call so failures are logged and not swallowed silently.

**Two separate offline systems working together:**

| System | What it does | Auto-syncs to Firestore? |
|---|---|---|
| Firestore IndexedDB (`persistentLocalCache`) | Queues writes locally when offline | ✅ Yes, automatically on reconnect |
| localStorage backup | Stores latest state as plain JSON | ❌ No — display/disaster recovery only |

For normal offline use (spotty mobile connection), IndexedDB handles everything.
localStorage is the fallback if the Firestore listener errors out completely.

**Why this matters:**
Firestore's real-time listeners update the in-memory signal immediately (optimistic update),
so the UI looks correct even when the write never actually reached the server.
The bug only appears on next load — the data looks saved but wasn't.
This is especially common on mobile with spotty connections.
