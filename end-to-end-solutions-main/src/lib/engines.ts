// FERWAFA rules engines: suspension calculator, eligibility, conduct scoring, league table.
// Pure functions — no DB calls. Inputs come from query results in the page.

export type Incident =
  | "yellow_accumulation"
  | "dogso"
  | "violent_conduct"
  | "abusive_language"
  | "disrepute"
  | "spitting"
  | "second_yellow"
  | "red_card";

export interface SuspensionRuling {
  matches: number;
  fine: number;
  article: string;
  explanation: string;
}

const FERWAFA_BASE: Record<Incident, Omit<SuspensionRuling, "explanation">> = {
  yellow_accumulation: { matches: 1, fine: 30000, article: "FERWAFA Disciplinary Code Art. 14.1" },
  second_yellow:       { matches: 1, fine: 20000, article: "FERWAFA Disciplinary Code Art. 14.2" },
  red_card:            { matches: 1, fine: 50000, article: "FERWAFA Disciplinary Code Art. 15.1" },
  dogso:               { matches: 1, fine: 75000, article: "FERWAFA Disciplinary Code Art. 15.2 (DOGSO)" },
  violent_conduct:     { matches: 3, fine: 200000, article: "FERWAFA Disciplinary Code Art. 16.1" },
  abusive_language:    { matches: 2, fine: 100000, article: "FERWAFA Disciplinary Code Art. 17.1" },
  disrepute:           { matches: 2, fine: 150000, article: "FERWAFA Disciplinary Code Art. 18.1" },
  spitting:            { matches: 6, fine: 300000, article: "FERWAFA Disciplinary Code Art. 16.3 (Spitting)" },
};

export function calculateSuspension(
  incident: Incident,
  history: { season_yellows?: number; season_reds?: number; prior_offences?: number } = {}
): SuspensionRuling {
  const base = FERWAFA_BASE[incident];
  const prior = history.prior_offences ?? 0;
  // Repeat offender escalation: +1 match per prior similar offence (cap +3)
  const escalation = Math.min(prior, 3);
  const matches = base.matches + escalation;
  const fine = base.fine + escalation * 25000;
  const explanation =
    `Per ${base.article}: base sanction is ${base.matches} match(es) and RWF ${base.fine.toLocaleString()}.` +
    (escalation > 0 ? ` Escalated by ${escalation} match(es) for ${prior} prior similar offence(s).` : "") +
    ` Final sanction: ${matches} match suspension, RWF ${fine.toLocaleString()} fine.`;
  return { matches, fine, article: base.article, explanation };
}

// Eligibility check
export interface EligibilityInput {
  status: string;
  license_active: boolean;
  active_suspensions: number; // count of active discipline records
}
export function checkEligibility(p: EligibilityInput): { eligible: boolean; reason: string } {
  if (!p.license_active) return { eligible: false, reason: "License inactive" };
  if (p.status === "suspended" || p.active_suspensions > 0) return { eligible: false, reason: "Active suspension" };
  if (p.status === "injured") return { eligible: false, reason: "Injured" };
  if (p.status === "inactive") return { eligible: false, reason: "Inactive registration" };
  return { eligible: true, reason: "Cleared for next fixture" };
}

// Conduct score: rule-based, 0..1
export function computeConductScore(p: { yellow_cards: number; red_cards: number; appearances: number }): number {
  const apps = Math.max(p.appearances, 1);
  const cardsPerGame = (p.yellow_cards + p.red_cards * 3) / apps;
  // 0 cards/game -> 1.0; 1 card/game -> ~0.5; 2+ -> floor 0.1
  return Math.max(0.1, Math.min(1, 1 - cardsPerGame * 0.45));
}
export function conductBand(score: number): { label: string; color: string } {
  if (score >= 0.8) return { label: "Excellent", color: "text-success" };
  if (score >= 0.5) return { label: "Acceptable", color: "text-warning" };
  return { label: "Review required", color: "text-destructive" };
}

// League table calculation
export interface ClubRow {
  id: string; name: string; short_code: string;
  P: number; W: number; D: number; L: number;
  GF: number; GA: number; GD: number; Pts: number;
  form: string[]; // last 5: 'W'|'D'|'L'
  points_deduction: number;
}
export interface MatchRecord {
  home_club_id: string; away_club_id: string;
  home_score: number; away_score: number;
  status: string; kickoff_at: string;
}
export function buildLeagueTable(
  clubs: { id: string; name: string; short_code: string; points_deduction?: number }[],
  matches: MatchRecord[]
): ClubRow[] {
  const stats: Record<string, ClubRow> = {};
  clubs.forEach((c) => {
    stats[c.id] = {
      id: c.id, name: c.name, short_code: c.short_code,
      P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0,
      form: [], points_deduction: c.points_deduction ?? 0,
    };
  });
  const completed = matches
    .filter((m) => m.status === "completed")
    .sort((a, b) => +new Date(a.kickoff_at) - +new Date(b.kickoff_at));
  completed.forEach((m) => {
    const h = stats[m.home_club_id], a = stats[m.away_club_id];
    if (!h || !a) return;
    h.P++; a.P++;
    h.GF += m.home_score; h.GA += m.away_score;
    a.GF += m.away_score; a.GA += m.home_score;
    if (m.home_score > m.away_score) { h.W++; h.Pts += 3; a.L++; h.form.push("W"); a.form.push("L"); }
    else if (m.home_score < m.away_score) { a.W++; a.Pts += 3; h.L++; a.form.push("W"); h.form.push("L"); }
    else { h.D++; a.D++; h.Pts++; a.Pts++; h.form.push("D"); a.form.push("D"); }
  });
  Object.values(stats).forEach((s) => {
    s.GD = s.GF - s.GA;
    s.Pts -= s.points_deduction;
    s.form = s.form.slice(-5);
  });
  return Object.values(stats).sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF);
}

// Player Performance Index
export interface PlayerStat {
  id: string; full_name: string; club_id: string | null;
  goals: number; appearances: number; yellow_cards: number; red_cards: number;
}
export function performanceIndex(p: PlayerStat & { conduct?: number }): number {
  const apps = Math.max(p.appearances, 1);
  const goalsScore = Math.min(1, p.goals / 15) * 30;
  const appsScore  = Math.min(1, p.appearances / 30) * 15;
  const minScore   = Math.min(1, p.appearances / 30) * 15; // proxy for minutes
  const conduct    = (p.conduct ?? computeConductScore(p)) * 20;
  const assists    = Math.min(1, (p.goals * 0.4) / 10) * 20; // proxy
  return Math.round(goalsScore + appsScore + minScore + conduct + assists);
}
