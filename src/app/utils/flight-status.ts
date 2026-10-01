import { parseTimeString } from './first-up';
import { wallToUtcMs } from './zones';

export type FlightStatus = 'soon' | 'inflight' | 'landed' | null;

const SOON_BEFORE_MS = 2 * 3_600_000;   // "Boarding soon" from two hours before departure
const LANDED_FOR_MS  = 6 * 3_600_000;   // "Landed" stays up for six hours after arrival

/** The instant a flight time happens, read in its airport's zone; NaN when the time or zone is missing. */
export function flightMomentMs(dateISO: string | undefined, time: string | undefined, zone: string | undefined): number {
  const t = parseTimeString(time);
  if (!dateISO || !t || !zone) return NaN;
  return wallToUtcMs(dateISO, t.h, t.min, zone);
}

/**
 * Where a journey is right now: departure in the departure airport's zone,
 * arrival in the arrival airport's zone. Null when it is not close, or when
 * either end's zone or time is unknown (then nothing is claimed).
 */
export function flightStatus(depMs: number, arrMs: number, nowMs: number): FlightStatus {
  if (isNaN(depMs) || isNaN(arrMs) || arrMs < depMs) return null;
  if (nowMs >= depMs && nowMs < arrMs) return 'inflight';
  if (nowMs < depMs && depMs - nowMs <= SOON_BEFORE_MS) return 'soon';
  if (nowMs >= arrMs && nowMs - arrMs <= LANDED_FOR_MS) return 'landed';
  return null;
}

export const FLIGHT_STATUS_LABEL: Record<Exclude<FlightStatus, null>, string> = {
  soon: 'Boarding soon', inflight: 'In flight', landed: 'Landed',
};
