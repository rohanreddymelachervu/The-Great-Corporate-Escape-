/** The outcome of one clap; accuracy measures closeness to the target center. */
export interface FunHit {
  hit: boolean;
  points: number;
  accuracy: number;
}

const TARGET = 0.55;
const WINDOW_START = 0.43;
const WINDOW_END = 0.67;
const WINDOW_RADIUS = 0.12;

/** Inclusive timing window, with 20 points at either edge and 100 at center. */
export function judgeClap(position: number): FunHit {
  if (
    !Number.isFinite(position) ||
    position < WINDOW_START ||
    position > WINDOW_END
  ) {
    return { hit: false, points: 0, accuracy: 0 };
  }

  const accuracy = Math.max(
    0,
    Math.min(1, 1 - Math.abs(position - TARGET) / WINDOW_RADIUS),
  );
  return { hit: true, points: Math.round(20 + 80 * accuracy), accuracy };
}

export const FUN_LINES: string[] = [
  "Clap like your ESOPs can pay Bengaluru rent!",
  "One team, one dream, six Silk Board signals!",
  "Synergise harder — the filter coffee is watching!",
  "Our culture has no traffic. Only growth blockers!",
  "Make some noise! The runway isn't extending itself!",
];

/** Pure five-round activity state; the caller supplies round-local elapsed time. */
export class FunFriday {
  round = 0;
  hits = 0;
  score = 0;
  results: FunHit[] = [];
  readonly total = 5;

  get finished(): boolean {
    return this.round >= this.total;
  }

  /** Each round gets faster: 2600, 2420, 2240, 2060, then 1880 ms. */
  marker(elapsedMs: number): number {
    if (this.finished) return 1;
    if (Number.isNaN(elapsedMs)) return 0;
    const durationMs = 2600 - this.round * 180;
    return Math.max(0, Math.min(1, elapsedMs / durationMs));
  }

  /** Commit one attempt, including a miss, then advance to the next round. */
  beat(position: number): FunHit {
    if (this.finished) return { hit: false, points: 0, accuracy: 0 };

    const result = judgeClap(position);
    // Keep the stored result independent of the object returned to UI callers.
    this.results.push({ ...result });
    this.round += 1;
    if (result.hit) this.hits += 1;
    this.score += result.points;
    return result;
  }

  /** Reward description only: reading this getter never applies game effects. */
  get result(): {
    success: boolean;
    hits: number;
    score: number;
    bsChange: number;
    coffee: number;
    distractSeconds: number;
  } {
    const success = this.hits >= 3;
    return {
      success,
      hits: this.hits,
      score: this.score,
      bsChange: success ? -25 : 8,
      coffee: success ? 1 : 0,
      distractSeconds: success ? 12 : 0,
    };
  }
}
