export const FIRE_LIFETIME_MS = 8 * 60 * 60 * 1000;
export const MAX_LOGS = 5;

export interface FireState {
  lastFed: number;
  logs: number;
  totalLogs: number;
  born: number;
  deaths: number;
  longestAlive: number;
}

export interface Visitor {
  name: string;
  time: number;
  country?: string; // ISO 3166-1 alpha-2, e.g. "US", "IN"
}

export function getHealth(fire: FireState): number {
  const now = Date.now();
  const burnEnd = fire.lastFed + fire.logs * FIRE_LIFETIME_MS;
  const remaining = burnEnd - now;
  const total = MAX_LOGS * FIRE_LIFETIME_MS;
  return Math.max(0, Math.min(1, remaining / total));
}

export function isAlive(fire: FireState): boolean {
  return Date.now() < fire.lastFed + fire.logs * FIRE_LIFETIME_MS;
}

export function getFuelRemaining(fire: FireState): number {
  return Math.max(0, fire.lastFed + fire.logs * FIRE_LIFETIME_MS - Date.now());
}

export function getAgeString(born: number): string {
  const ms = Date.now() - born;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  const minutes = Math.floor(ms / (1000 * 60));
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  return 'just born';
}

export function getTimeLeftString(fire: FireState): string {
  const remaining = fire.lastFed + fire.logs * FIRE_LIFETIME_MS - Date.now();
  if (remaining <= 0) return 'burned out';
  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / (60 * 60 * 24));
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(totalSec / (60 * 60));
  const mins = Math.floor((totalSec % (60 * 60)) / 60);
  if (hours > 0) return `${hours}h ${mins}m left`;
  if (mins > 0) return `${mins}m left`;
  return `${totalSec}s left`;
}

export function formatRelativeTime(time: number): string {
  const diff = Date.now() - time;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function defaultFireState(): FireState {
  const now = Date.now();
  return {
    lastFed: now,
    logs: 3,
    totalLogs: 0,
    born: now,
    deaths: 0,
    longestAlive: 0,
  };
}
