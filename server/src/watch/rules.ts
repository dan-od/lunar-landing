// The four watch rules. Each one asks the same calculator the API uses (the
// windows, the slip list, the miss odds), so a rule can never disagree with
// the page or the API (F-7, 7-6). An answer is "holds", "broken" or "cannot
// tell", with one plain sentence that carries the numbers; that sentence is
// what goes into the event log and the alert email (5-5).
import type { Aim, ModelName } from '@moon/core';
import { aimText, thresholdFor } from '@moon/core';
import { ApiError } from '../api/errors.js';
import { SYSTEM_VISITOR, type Calc } from '../api/calc.js';

export const RULES = [
  { id: 'power', label: 'No power at landing' },
  { id: 'link3', label: 'Contact lost too long' },
  { id: 'slip14', label: 'Not slip-proof' },
  { id: 'odds70', label: 'Odds too low' },
] as const;

export type RuleId = (typeof RULES)[number]['id'];

export const isRuleId = (v: unknown): v is RuleId => RULES.some((r) => r.id === v);
export const ruleLabel = (id: string): string => RULES.find((r) => r.id === id)?.label ?? id;

/** The watched scenario. The place is the watch's site; an aim is metres from its target. */
export interface WatchScenario {
  date: string;
  hour: number;
  margin: number;
  accuracy: number;
  aim?: Aim;
}

export interface Evaluation {
  /** true: the rule holds. false: it is broken. null: it cannot be told (no alert). */
  holds: boolean | null;
  /** One plain sentence with the numbers. */
  reason: string;
  model: ModelName;
}

export interface Evaluator {
  evaluate(siteId: string, rule: RuleId, scenario: WatchScenario): Promise<Evaluation>;
}

/** Longest allowed gap in Earth contact, in days. */
const MAX_GAP_DAYS = 3;
/** Days of contact looked at. */
const CONTACT_DAYS = 30;
/** Landings out of ten that must work. */
const MIN_OUT_OF_TEN = 7;

/** Which model a rule's answer comes from for a scenario. */
export function modelFor(rule: RuleId, scenario: WatchScenario): ModelName {
  if (rule === 'odds70') return 'terrain';
  if (rule === 'slip14') return 'smooth Moon';
  return scenario.aim ? 'terrain' : 'smooth Moon';
}

const when = (date: string, hour: number): string => `${date} ${String(hour).padStart(2, '0')}:00 UTC`;
const deg = (n: number): string => n.toFixed(1);
const days = (n: number): string => n.toFixed(1);

export function createEvaluator(calc: Calc): Evaluator {
  const place = (siteId: string) => ({ visitor: SYSTEM_VISITOR, place: { site: siteId } });

  async function power(siteId: string, s: WatchScenario): Promise<Evaluation> {
    const w = await calc.computeWindows({ ...place(siteId), start: s.date, hour: s.hour, days: 1, margin: s.margin, aim: s.aim });
    const model = w.result.model;
    const sun = w.sunInSpan[0]!;
    const needed = thresholdFor(sun, s.margin, w.horizon);
    const bar = w.horizon
      ? `the ${deg(needed)} degree terrain horizon at the aim point`
      : `the ${deg(needed)} degree shadow allowance`;
    const at = `at ${when(s.date, s.hour)} the Sun is at ${deg(sun.elevationDeg)} degrees`;
    const holds = w.result.landing.powerUp;
    return {
      holds,
      model,
      reason: holds
        ? `Power at landing: ${at}, above ${bar} (${model} model).`
        : `No power at landing: ${at}, not above ${bar} (${model} model).`,
    };
  }

  async function link3(siteId: string, s: WatchScenario): Promise<Evaluation> {
    const w = await calc.computeWindows({
      ...place(siteId),
      start: s.date,
      hour: s.hour,
      days: CONTACT_DAYS,
      margin: s.margin,
      aim: s.aim,
    });
    const model = w.result.model;
    const gap = w.result.contact.longestGapDays;
    const span = `in the ${CONTACT_DAYS} days from ${when(s.date, s.hour)}`;
    if (gap > MAX_GAP_DAYS) {
      return {
        holds: false,
        model,
        reason: `Contact lost too long: the longest gap in Earth contact ${span} is ${days(gap)} days, more than ${MAX_GAP_DAYS} days (${model} model).`,
      };
    }
    // A gap can hide in hours that are not saved, so a part-covered span is not a pass.
    const savedDays = Math.floor(w.earthInSpan.length / 24);
    if (w.complete === false || w.earthInSpan.length < CONTACT_DAYS * 24) {
      return {
        holds: null,
        model,
        reason: `Contact could not be checked: positions are saved for only ${savedDays} of the ${CONTACT_DAYS} days from ${when(s.date, s.hour)} (${model} model).`,
      };
    }
    return {
      holds: true,
      model,
      reason: `Contact holds: the longest gap in Earth contact ${span} is ${days(gap)} days, within the ${MAX_GAP_DAYS} day limit (${model} model).`,
    };
  }

  async function slip14(siteId: string, s: WatchScenario): Promise<Evaluation> {
    const site = await calc.resolveSite({ site: siteId }, SYSTEM_VISITOR);
    // The same list GET /v1/slip returns, and the same slip-proof answer (7-6).
    const { slipProof, slips } = await calc.computeSlip({ site, date: s.date, hour: s.hour, margin: s.margin });
    const model: ModelName = 'smooth Moon';
    const forward = slips.filter((x) => x.slip_days >= 0 && x.slip_days <= 14);
    const first = forward[0]?.date ?? s.date;
    const last = forward[forward.length - 1]?.date ?? s.date;
    const range = `the 15 landing days from ${first} to ${last}`;
    if (slipProof === true) {
      return { holds: true, model, reason: `Slip-proof: the site is ready on all of ${range} (${model} model).` };
    }
    if (slipProof === false) {
      const notReady = forward.filter((x) => x.ready === false);
      const worst = notReady[0]!;
      const slipWords = worst.slip_days === 0 ? 'the planned day' : `a slip of ${worst.slip_days} ${worst.slip_days === 1 ? 'day' : 'days'}`;
      return {
        holds: false,
        model,
        reason: `Not slip-proof: the site is not ready on ${notReady.length} of ${range}, first on ${worst.date} (${slipWords}: ${worst.word}) (${model} model).`,
      };
    }
    const known = forward.filter((x) => x.ready !== null).length;
    return {
      holds: null,
      model,
      reason: `Slips could not be checked: positions are available for only ${known} of the 15 landing days from ${s.date} (${model} model).`,
    };
  }

  async function odds70(siteId: string, s: WatchScenario): Promise<Evaluation> {
    const site = await calc.resolveSite({ site: siteId }, SYSTEM_VISITOR);
    // The same odds GET /v1/miss returns (F-7).
    const miss = await calc.computeMiss({
      site,
      date: s.date,
      hour: s.hour,
      aim: s.aim ?? { east: 0, north: 0 },
      eastField: 'aim_east',
      northField: 'aim_north',
    });
    const model: ModelName = 'terrain';
    const line = miss.odds.find((o) => o.accuracy_m === s.accuracy);
    if (!line) {
      return { holds: null, model, reason: `Odds could not be checked: ${s.accuracy} m is not one of the lander accuracies (${model} model).` };
    }
    const what = `${line.out_of_10} in 10 landings would work within ${s.accuracy} m of the aim (${aimText(miss.aim)}) for a landing at ${when(s.date, s.hour)}`;
    const holds = line.out_of_10 >= MIN_OUT_OF_TEN;
    return {
      holds,
      model,
      reason: holds
        ? `Odds hold: ${what}, at least ${MIN_OUT_OF_TEN} in 10 (${model} model).`
        : `Odds too low: ${what}, fewer than ${MIN_OUT_OF_TEN} in 10 (${model} model).`,
    };
  }

  const run = { power, link3, slip14, odds70 } as const;

  return {
    async evaluate(siteId, rule, scenario) {
      try {
        return await run[rule](siteId, scenario);
      } catch (err) {
        const model = modelFor(rule, scenario);
        // Missing positions or terrain: say so, never guess (AGENTS.md data rules).
        const why = err instanceof ApiError ? err.message : 'The check did not finish.';
        if (!(err instanceof ApiError)) {
          console.error(`[watch] rule ${rule} for site ${siteId} did not finish: ${err instanceof Error ? err.name : 'error'}`);
        }
        return { holds: null, model, reason: `This rule could not be checked: ${why} (${model} model).` };
      }
    },
  };
}
