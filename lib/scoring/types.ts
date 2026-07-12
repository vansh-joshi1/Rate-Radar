export type SourceStatus = 'ok' | 'failed' | 'awaiting-key';

export interface SourceResult {
  source: string;
  status: SourceStatus;
  error?: string;
  fetchedAt: string;
  data?: unknown;
}

export interface RawEvent {
  id: string;
  name: string;
  /** Night affected, YYYY-MM-DD (America/Chicago). */
  date: string;
  venue: string;
  /** null → classifier falls back to venue map / kind default. */
  capacity: number | null;
  /** Overrides the capacity×fill heuristic when a real figure is known. */
  expectedAttendance?: number;
  kind: 'concert' | 'sports' | 'convention' | 'university' | 'holiday' | 'other';
  isTouring?: boolean;
  multiNight?: boolean;
  selloutLikely?: boolean;
  source: string;
}

export type Tier = 'too-small' | 'minor' | 'meaningful' | 'major';

export interface ScoredEvent extends RawEvent {
  attendanceEstimate: number;
  baseDraw: number;
  travelDraw: number;
  dowMultiplier: number;
  score: number;
  tier: Tier;
  /** One plain-language line, always shown — including "too small to matter". */
  verdict: string;
}

export interface WeatherAlert {
  event: string;
  severity: string;
  headline: string;
  isWinter: boolean;
  area: string;
}

export interface RateCheck {
  source: 'redroof' | 'google' | 'expedia' | 'booking';
  status: 'ok' | 'needs-manual-check';
  price?: number;
  room?: string;
  error?: string;
  fetchedAt: string;
}

export interface TierRecommendation {
  tierId: string;
  label: string;
  baselineMid: number;
  recommended: number;
  range: [number, number];
}

export interface NightRecommendation {
  date: string;
  dow: number;
  nightScore: number;
  upliftPct: number;
  events: ScoredEvent[];
  tiers: TierRecommendation[];
  weatherNote?: string;
  bnaNote?: string;
  holidayName?: string;
  reasoning: string[];
}

export interface CompsetEntry {
  name: string;
  price: number;
}

export interface CompsetInfo {
  /** Night the competitor prices apply to (the checked check-in date). */
  date: string;
  entries: CompsetEntry[];
  median: number | null;
}

export interface Snapshot {
  runAt: string;
  runId: string;
  confidence: number;
  confidenceNote: string;
  nights: NightRecommendation[];
  parity: RateCheck[];
  compset?: CompsetInfo;
  sources: SourceResult[];
}

export interface HistoryRecord {
  date: string;
  recommendedStandard: number;
  recommendedQueen: number;
  nightScore: number;
  topDriver: string;
  recordedAt: string;
}
