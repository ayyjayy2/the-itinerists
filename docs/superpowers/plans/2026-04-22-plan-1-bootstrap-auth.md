# Plan 1: Project Bootstrap + Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Triplan React Native app from scratch with working authentication — register, login, password reset, and an auth-gated shell ready for trip screens.

**Architecture:** Expo managed workflow with Expo Router for file-based navigation. Firebase Auth for email/password authentication. Firestore for user profiles. AuthContext provides auth state to the entire app, gating access to authenticated routes.

**Tech Stack:** React Native, Expo SDK 52, Expo Router v4, TypeScript, @react-native-firebase/app, @react-native-firebase/auth, @react-native-firebase/firestore

**Spec reference:** `docs/superpowers/specs/2026-04-22-triplan-multi-trip-architecture-design.md` — Sections 1.1, 2, 3, 7, 8

---

## File Map

```
triplan/                              NEW Expo project (created via npx)
├── app/
│   ├── _layout.tsx                   Root layout — auth state check, provider wrapping
│   ├── (auth)/
│   │   ├── _layout.tsx               Auth group layout (stack navigator)
│   │   ├── login.tsx                 Login screen
│   │   └── register.tsx              Register screen
│   └── (app)/
│       ├── _layout.tsx               App group layout (placeholder for trip screens)
│       └── index.tsx                 Placeholder home (will become My Trips in Plan 2)
├── contexts/
│   └── AuthContext.tsx                Auth provider + useAuth hook
├── models/
│   └── types.ts                      All Firestore document interfaces
├── lib/
│   └── firebase.ts                   Firebase app init
├── __tests__/
│   └── models/
│       └── types.test.ts             Type guard tests
├── firestore.rules                   Firestore security rules
├── app.json                          Expo config (modified)
├── tsconfig.json                     TypeScript config (modified)
└── google-services.json / GoogleService-Info.plist   Firebase config files
```

---

### Task 1: Initialize Expo Project

**Files:**
- Create: `triplan/` (entire project scaffold)
- Modify: `triplan/app.json`
- Modify: `triplan/tsconfig.json`

- [ ] **Step 1: Create Expo project with Expo Router template**

```bash
cd /Users/alayna/Documents/Code/mobileApps
npx create-expo-app@latest triplan --template tabs
cd triplan
```

Expected: New `triplan/` directory with Expo Router tab template.

- [ ] **Step 2: Verify project runs**

```bash
npx expo start
```

Expected: Metro bundler starts. Press `i` for iOS simulator or `a` for Android emulator. App loads with default template tabs. Kill the server with `Ctrl+C`.

- [ ] **Step 3: Clean out template boilerplate**

Delete the template's example screens and tabs — we'll replace them with our own structure.

```bash
rm -rf app/(tabs) app/+not-found.tsx components/__tests__ constants
rm -f app/+html.tsx
```

- [ ] **Step 4: Create initial root layout**

Replace `app/_layout.tsx` with a minimal shell:

```typescript
// app/_layout.tsx
import { Slot } from 'expo-router';

export default function RootLayout() {
  return <Slot />;
}
```

- [ ] **Step 5: Create placeholder index screen**

```typescript
// app/index.tsx
import { View, Text, StyleSheet } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Triplan</Text>
      <Text style={styles.subtitle}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  title: { fontSize: 32, fontWeight: '700', color: '#ffffff' },
  subtitle: { fontSize: 16, color: '#a0a0b8', marginTop: 8 },
});
```

- [ ] **Step 6: Verify clean app runs**

```bash
npx expo start
```

Expected: App shows "Triplan" / "Loading..." centered on dark background. Kill server.

- [ ] **Step 7: Commit**

```bash
git init
echo "node_modules/\n.expo/\ndist/\n*.jks\n*.p8\n*.p12\n*.key\n*.mobileprovision\n*.orig.*\nweb-build/\n.env" > .gitignore
git add -A
git commit -m "feat: initialize Triplan Expo project with clean shell"
```

---

### Task 2: Install Firebase Dependencies

**Files:**
- Modify: `triplan/package.json`
- Modify: `triplan/app.json`

- [ ] **Step 1: Install React Native Firebase core + auth + firestore**

```bash
npx expo install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
```

Expected: Packages added to `package.json`. No errors.

- [ ] **Step 2: Install Expo dev client (required for native Firebase modules)**

React Native Firebase uses native modules, so we need a dev client build instead of Expo Go:

```bash
npx expo install expo-dev-client
```

- [ ] **Step 3: Install AsyncStorage (for persisting lastActiveTrip)**

```bash
npx expo install @react-native-async-storage/async-storage
```

- [ ] **Step 4: Configure app.json for Firebase**

Add the React Native Firebase plugin to `app.json`. Open `app.json` and add to the `expo` object:

```json
{
  "expo": {
    "name": "Triplan",
    "slug": "triplan",
    "scheme": "triplan",
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "@react-native-firebase/firestore"
    ]
  }
}
```

Note: `scheme: "triplan"` enables deep linking for `triplan://` URLs (needed for invite flow in Plan 3).

- [ ] **Step 5: Create Firebase project and download config files**

This step is manual:
1. Go to https://console.firebase.google.com → Create new project "Triplan"
2. Enable **Authentication** → Email/Password sign-in method
3. Enable **Cloud Firestore** → Start in test mode (we'll deploy rules later)
4. Add an **iOS app** → download `GoogleService-Info.plist` → place in `triplan/` root
5. Add an **Android app** (package: `com.triplan.app`) → download `google-services.json` → place in `triplan/` root

- [ ] **Step 6: Reference config files in app.json**

Add to the `expo` object in `app.json`:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.triplan.app",
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "android": {
      "package": "com.triplan.app",
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add package.json app.json package-lock.json
git commit -m "feat: install Firebase + AsyncStorage dependencies"
```

Note: Do NOT commit `GoogleService-Info.plist` or `google-services.json` — these contain API keys. Add them to `.gitignore`:

```bash
echo "google-services.json\nGoogleService-Info.plist" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore Firebase config files"
```

---

### Task 3: TypeScript Type Definitions

**Files:**
- Create: `triplan/models/types.ts`
- Create: `triplan/__tests__/models/types.test.ts`

- [ ] **Step 1: Write type guard tests**

```typescript
// __tests__/models/types.test.ts
import { isValidTravelMode, isValidMemberRole, isValidActivityAction } from '../../models/types';

describe('type guards', () => {
  test('isValidTravelMode accepts valid modes', () => {
    expect(isValidTravelMode('flying')).toBe(true);
    expect(isValidTravelMode('driving')).toBe(true);
    expect(isValidTravelMode('train')).toBe(true);
    expect(isValidTravelMode('bus')).toBe(true);
    expect(isValidTravelMode('other')).toBe(true);
  });

  test('isValidTravelMode rejects invalid modes', () => {
    expect(isValidTravelMode('bicycle')).toBe(false);
    expect(isValidTravelMode('')).toBe(false);
  });

  test('isValidMemberRole accepts valid roles', () => {
    expect(isValidMemberRole('owner')).toBe(true);
    expect(isValidMemberRole('member')).toBe(true);
  });

  test('isValidMemberRole rejects invalid roles', () => {
    expect(isValidMemberRole('admin')).toBe(false);
  });

  test('isValidActivityAction accepts valid actions', () => {
    expect(isValidActivityAction('member_added')).toBe(true);
    expect(isValidActivityAction('member_removed')).toBe(true);
    expect(isValidActivityAction('member_restored')).toBe(true);
    expect(isValidActivityAction('member_left')).toBe(true);
  });

  test('isValidActivityAction rejects invalid actions', () => {
    expect(isValidActivityAction('member_banned')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest __tests__/models/types.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create type definitions**

```typescript
// models/types.ts

// ── Enums & Constants ─────────────────────────────────────────────────────────

export const TRAVEL_MODES = ['flying', 'driving', 'train', 'bus', 'other'] as const;
export type TravelMode = typeof TRAVEL_MODES[number];

export const MEMBER_ROLES = ['owner', 'member'] as const;
export type MemberRole = typeof MEMBER_ROLES[number];

export const ACTIVITY_ACTIONS = ['member_added', 'member_removed', 'member_restored', 'member_left'] as const;
export type ActivityAction = typeof ACTIVITY_ACTIONS[number];

// Type guards
export function isValidTravelMode(value: string): value is TravelMode {
  return (TRAVEL_MODES as readonly string[]).includes(value);
}

export function isValidMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value);
}

export function isValidActivityAction(value: string): value is ActivityAction {
  return (ACTIVITY_ACTIONS as readonly string[]).includes(value);
}

// ── User (global) ─────────────────────────────────────────────────────────────

export interface UserDoc {
  displayName: string;
  username: string;
  email: string;
  avatarEmoji: string;
  color: string;
  createdAt: number;
}

// ── Trip ──────────────────────────────────────────────────────────────────────

export interface TripDoc {
  name: string;
  destination: string;
  destinationPlaceId: string;
  destinationCoords: { lat: number; lng: number };
  startDate: string;
  endDate: string;
  currency: string;
  coverPhotoUrl?: string;
  createdBy: string;
  createdAt: number;
  memberCount: number;
}

// ── Trip Member ──────────────────────────────────────────────────────────────

export interface TripMemberDoc {
  role: MemberRole;
  displayName: string;
  avatarEmoji: string;
  color: string;
  joinedAt: number;
  travelMode?: TravelMode | null;
  arrivalDate?: string;
  arrivalTime?: string;
  departureDate?: string;
  departureTime?: string;
  hiddenPages?: string[];
}

// ── Invite ───────────────────────────────────────────────────────────────────

export interface InviteDoc {
  code: string;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  usedBy: string[];
}

export interface InviteIndexDoc {
  tripId: string;
  expiresAt: number;
}

// ── Activity Log ─────────────────────────────────────────────────────────────

export interface ActivityLogDoc {
  action: ActivityAction;
  targetUid: string;
  performedByUid: string;
  timestamp: number;
}

// ── Travel ───────────────────────────────────────────────────────────────────

export interface TravelDoc {
  uid: string;
  addedByUid: string;
  mode: TravelMode;
  direction: 'arrival' | 'departure';
  createdAt: number;

  // Flying
  airline?: string;
  flightNumber?: string;
  from?: string;
  to?: string;

  // Driving
  origin?: string;
  estimatedDuration?: string;

  // Train/Bus
  carrier?: string;
  departureStation?: string;
  arrivalStation?: string;

  // Common
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  notes: string;
}

// ── User Trips Index ─────────────────────────────────────────────────────────

export interface UserTripsDoc {
  tripIds: string[];
  lastActiveTrip: string;
}

// ── Content Sub-Collections ──────────────────────────────────────────────────
// These will be fully defined in Plan 5 (Content Screens).
// Placeholder interfaces for now so other plans can reference them.

export interface ItineraryItemDoc {
  id: string;
  date: string;
  time: string;
  endTime: string;
  activity: string;
  location: string;
  category: string;
  notes: string;
  forWho: string;
  addedByUid: string;
  sortOrder: number;
  createdAt: number;
}

export interface FinanceEntryDoc {
  id: string;
  date: string;
  vendor?: string;
  description: string;
  amount: number;
  currency: string;
  paidBy: string;
  splitAmong: string;
  splits?: Record<string, number>;
  category: string;
  notes?: string;
  link?: string;
  addedByUid: string;
  createdAt: number;
}

export interface AccommodationDoc {
  id: string;
  name: string;
  address: string;
  checkIn: string;
  checkOut: string;
  notes: string;
  bookingRef: string;
  link?: string;
  forWho: string;
  addedByUid: string;
  createdAt: number;
}

export interface RecDoc {
  id: string;
  category: string;
  title: string;
  description: string;
  extra: string;
  addedByUid: string;
  createdAt: number;
}

export interface MapPinDoc {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  notes?: string;
  addedBy: string;
  forWho: string;
}

export interface OutfitEntryDoc {
  date: string;
  user: string;
  items: string[];
  photoUrl?: string;
  notes?: string;
}

export interface PackingItemDoc {
  id: string;
  label: string;
  packed: boolean;
  addedAt: number;
  category?: string;
}

export interface RentalCarDoc {
  id: string;
  company: string;
  confirmationNumber: string;
  pickupDate: string;
  pickupTime: string;
  pickupLocation: string;
  dropoffDate: string;
  dropoffTime: string;
  dropoffLocation: string;
  drivers: string;
  notes: string;
  platform?: string;
  link?: string;
  rentalName?: string;
  passengers?: string;
  location?: string;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest __tests__/models/types.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add models/types.ts __tests__/models/types.test.ts
git commit -m "feat: add Firestore document type definitions with type guards"
```

---

### Task 4: Firebase Initialization

**Files:**
- Create: `triplan/lib/firebase.ts`

- [ ] **Step 1: Create Firebase init module**

```typescript
// lib/firebase.ts
import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// @react-native-firebase auto-initializes from GoogleService-Info.plist (iOS)
// and google-services.json (Android). No manual config needed.

export { firebase, auth, firestore };
```

- [ ] **Step 2: Commit**

```bash
git add lib/firebase.ts
git commit -m "feat: add Firebase initialization module"
```

---

### Task 5: Auth Context

**Files:**
- Create: `triplan/contexts/AuthContext.tsx`

- [ ] **Step 1: Create AuthContext with provider and hook**

```typescript
// contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { UserDoc } from '../models/types';

interface AuthContextValue {
  user: FirebaseAuthTypes.User | null;
  userDoc: UserDoc | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
    username: string,
    avatarEmoji: string,
    color: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserDoc(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Listen to user's Firestore profile when authenticated
  useEffect(() => {
    if (!user) return;

    const unsubscribe = firestore()
      .collection('users')
      .doc(user.uid)
      .onSnapshot(
        (snap) => {
          setUserDoc(snap.exists ? (snap.data() as UserDoc) : null);
          setLoading(false);
        },
        () => {
          setLoading(false);
        },
      );
    return unsubscribe;
  }, [user]);

  async function login(email: string, password: string): Promise<void> {
    await auth().signInWithEmailAndPassword(email, password);
  }

  async function register(
    email: string,
    password: string,
    displayName: string,
    username: string,
    avatarEmoji: string,
    color: string,
  ): Promise<void> {
    // Check username uniqueness
    const existing = await firestore()
      .collection('users')
      .where('username', '==', username.toLowerCase().trim())
      .get();
    if (!existing.empty) {
      throw new Error('That username is already taken.');
    }

    // Create Firebase Auth account
    const cred = await auth().createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    // Write Firestore user profile
    const newUserDoc: UserDoc = {
      displayName: displayName.trim(),
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      avatarEmoji,
      color,
      createdAt: Date.now(),
    };
    await firestore().collection('users').doc(uid).set(newUserDoc);
  }

  async function logout(): Promise<void> {
    await auth().signOut();
  }

  async function resetPassword(email: string): Promise<void> {
    await auth().sendPasswordResetEmail(email);
  }

  return (
    <AuthContext.Provider
      value={{ user, userDoc, loading, login, register, logout, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 2: Commit**

```bash
git add contexts/AuthContext.tsx
git commit -m "feat: add AuthContext with login, register, logout, resetPassword"
```

---

### Task 6: Root Layout with Auth Gate

**Files:**
- Modify: `triplan/app/_layout.tsx`
- Create: `triplan/app/(auth)/_layout.tsx`
- Create: `triplan/app/(app)/_layout.tsx`
- Create: `triplan/app/(app)/index.tsx`
- Modify: `triplan/app/index.tsx`

- [ ] **Step 1: Update root layout with AuthProvider and auth gate**

```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import { Redirect, Slot } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6a6aff" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(app)" />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
});
```

- [ ] **Step 2: Update the index to use the auth gate**

```typescript
// app/index.tsx
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6a6aff" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(app)" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
});
```

- [ ] **Step 3: Create auth group layout**

```typescript
// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#1a1a2e' },
      }}
    />
  );
}
```

- [ ] **Step 4: Create app group layout (placeholder)**

```typescript
// app/(app)/_layout.tsx
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#1a1a2e' },
      }}
    />
  );
}
```

- [ ] **Step 5: Create placeholder authenticated home screen**

```typescript
// app/(app)/index.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function AppHome() {
  const { userDoc, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{userDoc?.avatarEmoji ?? '👤'}</Text>
      <Text style={styles.title}>Welcome, {userDoc?.displayName ?? 'User'}!</Text>
      <Text style={styles.subtitle}>My Trips screen coming in Plan 2</Text>
      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 24 },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#ffffff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#a0a0b8', marginBottom: 32 },
  button: { backgroundColor: '#6a6aff', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 6: Commit**

```bash
git add app/_layout.tsx app/index.tsx app/\(auth\)/_layout.tsx app/\(app\)/_layout.tsx app/\(app\)/index.tsx
git commit -m "feat: add auth-gated root layout with route groups"
```

---

### Task 7: Login Screen

**Files:**
- Create: `triplan/app/(auth)/login.tsx`

- [ ] **Step 1: Create login screen**

```typescript
// app/(auth)/login.tsx
import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const { login, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(app)');
    } catch (err: any) {
      Alert.alert('Login Failed', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!resetEmail.trim()) {
      Alert.alert('Error', 'Please enter your email.');
      return;
    }
    try {
      await resetPassword(resetEmail.trim());
      Alert.alert('Email Sent', 'Check your inbox for a password reset link.');
      setShowReset(false);
      setResetEmail('');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not send reset email.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>Triplan</Text>
        <Text style={styles.subtitle}>Plan trips together</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#707090"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#707090"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Log In'}</Text>
        </Pressable>

        <Pressable onPress={() => setShowReset(true)}>
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>

        <Link href="/(auth)/register" asChild>
          <Pressable>
            <Text style={styles.link}>Don't have an account? Sign up</Text>
          </Pressable>
        </Link>

        {showReset && (
          <View style={styles.resetBox}>
            <Text style={styles.resetTitle}>Reset Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#707090"
              value={resetEmail}
              onChangeText={setResetEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.resetRow}>
              <Pressable style={styles.resetButton} onPress={handleResetPassword}>
                <Text style={styles.buttonText}>Send Reset Link</Text>
              </Pressable>
              <Pressable onPress={() => setShowReset(false)}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#1a1a2e' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 36, fontWeight: '700', color: '#ffffff', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#a0a0b8', textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: '#252540', borderWidth: 1, borderColor: '#3a3a5c', borderRadius: 12,
    padding: 14, fontSize: 16, color: '#e8e8e8', marginBottom: 12,
  },
  button: {
    backgroundColor: '#6a6aff', borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  link: { color: '#8a8aff', textAlign: 'center', fontSize: 14, marginBottom: 12 },
  resetBox: {
    marginTop: 16, padding: 16, backgroundColor: '#252540',
    borderRadius: 12, borderWidth: 1, borderColor: '#3a3a5c',
  },
  resetTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 12 },
  resetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  resetButton: {
    backgroundColor: '#6a6aff', borderRadius: 12, paddingHorizontal: 20,
    paddingVertical: 10, flex: 1, alignItems: 'center',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/login.tsx
git commit -m "feat: add login screen with password reset"
```

---

### Task 8: Register Screen

**Files:**
- Create: `triplan/app/(auth)/register.tsx`

- [ ] **Step 1: Create register screen**

```typescript
// app/(auth)/register.tsx
import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

const AVATAR_EMOJIS = ['🌸', '🍀', '🌻', '💙', '🫐', '🧡', '💚', '🌷', '⭐', '🌊', '🔥', '🦋'];
const AVATAR_COLORS = [
  '#F4C2C2', '#88C9A1', '#F9E4B7', '#B5D5F5',
  '#D4B5F5', '#F5D4B5', '#B5F5D4', '#F5B5D4',
];

export default function RegisterScreen() {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🌸');
  const [selectedColor, setSelectedColor] = useState('#F4C2C2');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!displayName.trim() || !username.trim() || !email.trim() || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, displayName, username, selectedEmoji, selectedColor);
      router.replace('/(app)');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create Account</Text>

        <TextInput
          style={styles.input}
          placeholder="Display Name"
          placeholderTextColor="#707090"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#707090"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#707090"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <TextInput
          style={styles.input}
          placeholder="Password (6+ characters)"
          placeholderTextColor="#707090"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
        />

        <Text style={styles.sectionLabel}>Choose your avatar</Text>
        <View style={styles.emojiRow}>
          {AVATAR_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              style={[
                styles.emojiOption,
                selectedEmoji === emoji && styles.emojiSelected,
              ]}
              onPress={() => setSelectedEmoji(emoji)}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Choose your color</Text>
        <View style={styles.colorRow}>
          {AVATAR_COLORS.map((color) => (
            <Pressable
              key={color}
              style={[
                styles.colorOption,
                { backgroundColor: color },
                selectedColor === color && styles.colorSelected,
              ]}
              onPress={() => setSelectedColor(color)}
            />
          ))}
        </View>

        <View style={styles.preview}>
          <View style={[styles.previewAvatar, { backgroundColor: selectedColor }]}>
            <Text style={styles.previewEmoji}>{selectedEmoji}</Text>
          </View>
          <Text style={styles.previewName}>{displayName || 'Your Name'}</Text>
        </View>

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Text>
        </Pressable>

        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text style={styles.link}>Already have an account? Log in</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#1a1a2e' },
  container: { flexGrow: 1, padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '700', color: '#ffffff', marginBottom: 24 },
  input: {
    backgroundColor: '#252540', borderWidth: 1, borderColor: '#3a3a5c', borderRadius: 12,
    padding: 14, fontSize: 16, color: '#e8e8e8', marginBottom: 12,
  },
  sectionLabel: { fontSize: 14, color: '#a0a0b8', marginTop: 12, marginBottom: 8 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  emojiOption: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: '#252540',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  emojiSelected: { borderColor: '#6a6aff' },
  emojiText: { fontSize: 22 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  colorOption: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent',
  },
  colorSelected: { borderColor: '#ffffff', borderWidth: 3 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  previewAvatar: {
    width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center',
  },
  previewEmoji: { fontSize: 24 },
  previewName: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  button: {
    backgroundColor: '#6a6aff', borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  link: { color: '#8a8aff', textAlign: 'center', fontSize: 14, marginBottom: 12 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/register.tsx
git commit -m "feat: add register screen with emoji/color avatar picker"
```

---

### Task 9: Firestore Security Rules

**Files:**
- Create: `triplan/firestore.rules`

- [ ] **Step 1: Create security rules file**

```
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }

    match /userTrips/{uid} {
      allow read, write: if request.auth.uid == uid;
    }

    match /inviteIndex/{code} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    match /trips/{tripId} {
      allow read: if isMember(tripId);
      allow create: if request.auth != null;
      allow update: if isMember(tripId);
      allow delete: if isOwner(tripId);
    }

    match /trips/{tripId}/invites/{code} {
      allow read: if request.auth != null;
      allow write: if isMember(tripId);
    }

    match /trips/{tripId}/members/{uid} {
      allow read: if isMember(tripId) || request.auth.uid == uid;
      allow create: if request.auth.uid == uid;
      allow update: if request.auth.uid == uid || isOwner(tripId);
      allow delete: if isMember(tripId) && uid != getOwnerUid(tripId);
    }

    match /trips/{tripId}/activityLog/{logId} {
      allow read: if isMember(tripId);
      allow create: if isMember(tripId) || request.auth != null;
    }

    match /trips/{tripId}/{collection}/{docId} {
      allow read: if isMember(tripId);
      allow create: if isMember(tripId);
      allow update: if isMember(tripId);
      allow delete: if isMember(tripId);
    }

    function isMember(tripId) {
      return exists(/databases/$(database)/documents/trips/$(tripId)/members/$(request.auth.uid));
    }

    function isOwner(tripId) {
      return get(/databases/$(database)/documents/trips/$(tripId)/members/$(request.auth.uid)).data.role == "owner";
    }

    function getOwnerUid(tripId) {
      return get(/databases/$(database)/documents/trips/$(tripId)).data.createdBy;
    }
  }
}
```

- [ ] **Step 2: Deploy rules to Firebase**

```bash
npx firebase-tools deploy --only firestore:rules
```

If `firebase-tools` isn't installed globally:

```bash
npx -y firebase-tools deploy --only firestore:rules
```

Expected: Rules deployed successfully.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore security rules for multi-trip architecture"
```

---

### Task 10: Build Dev Client & End-to-End Smoke Test

**Files:** None — this is a verification task.

- [ ] **Step 1: Build development client**

React Native Firebase requires a custom dev client (not Expo Go):

```bash
npx expo prebuild
npx expo run:ios
```

Or for Android:

```bash
npx expo run:android
```

Expected: App builds and launches on simulator/emulator.

- [ ] **Step 2: Smoke test — Register flow**

1. App opens → should redirect to Login screen
2. Tap "Don't have an account? Sign up" → Register screen
3. Fill in: display name, username, email, password, pick emoji + color
4. Tap "Create Account"
5. Expected: account created, redirects to placeholder home showing "Welcome, [name]!"
6. Verify in Firebase Console: Auth → user exists, Firestore → `/users/{uid}` doc exists

- [ ] **Step 3: Smoke test — Logout + Login flow**

1. Tap "Log Out" on home screen
2. Expected: redirects to Login screen
3. Enter the email + password from registration
4. Tap "Log In"
5. Expected: redirects back to home showing "Welcome, [name]!"

- [ ] **Step 4: Smoke test — Password reset**

1. Log out → Login screen
2. Tap "Forgot password?"
3. Enter email
4. Tap "Send Reset Link"
5. Expected: Alert says "Check your inbox for a password reset link"
6. Verify in email inbox: Firebase password reset email received

- [ ] **Step 5: Commit any adjustments from testing**

```bash
git add -A
git commit -m "chore: adjustments from end-to-end smoke testing"
```

---

## Plan Summary

After completing all 10 tasks, you have:

- A working Expo + React Native project with TypeScript
- Firebase Auth (email/password) with register, login, logout, password reset
- Firestore user profiles (`/users/{uid}`)
- Auth-gated navigation (login → authenticated home)
- Complete type definitions for all Firestore documents (ready for Plans 2-5)
- Deployed Firestore security rules
- Clean git history with atomic commits

**Next:** Plan 2 (Trip Management) builds on this to add TripContext, trip creation, My Trips list, and trip switching.
