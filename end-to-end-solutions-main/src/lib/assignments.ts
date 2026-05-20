import { supabase } from "@/integrations/supabase/client";

export interface ConflictCheck {
  ok: boolean;
  conflicts: string[];
}

/**
 * Detect conflicts of interest for a referee/match pairing:
 * - License inactive or expired
 * - Already assigned to another match within ±48h
 * - Specialization mentions a club involved in the fixture (district bias proxy)
 * - Previously officiated either club within last 14 days (rotation rule)
 */
export async function checkAssignmentConflicts(
  refereeId: string,
  matchId: string,
): Promise<ConflictCheck> {
  const conflicts: string[] = [];

  const [{ data: ref }, { data: match }] = await Promise.all([
    supabase.from("referees").select("*").eq("id", refereeId).single(),
    supabase.from("matches").select("*").eq("id", matchId).single(),
  ]);

  if (!ref || !match) return { ok: false, conflicts: ["Referee or match not found"] };

  const { data: clubsData } = await supabase
    .from("clubs")
    .select("id, name")
    .in("id", [match.home_club_id, match.away_club_id]);
  const homeName = clubsData?.find((c) => c.id === match.home_club_id)?.name?.toLowerCase() ?? "";
  const awayName = clubsData?.find((c) => c.id === match.away_club_id)?.name?.toLowerCase() ?? "";

  if (!ref.active) conflicts.push("Referee is inactive");
  if (ref.license_expiry && new Date(ref.license_expiry) < new Date()) {
    conflicts.push(`License expired ${ref.license_expiry}`);
  }

  const spec = (ref.specialization ?? "").toLowerCase();
  if ((homeName && spec.includes(homeName)) || (awayName && spec.includes(awayName))) {
    conflicts.push("Specialization mentions a participating club");
  }

  const kickoff = new Date(match.kickoff_at);
  const before = new Date(kickoff.getTime() - 48 * 3600 * 1000).toISOString();
  const after = new Date(kickoff.getTime() + 48 * 3600 * 1000).toISOString();

  const { data: nearby } = await supabase
    .from("matches")
    .select("id, match_code, kickoff_at")
    .eq("referee_id", refereeId)
    .neq("id", matchId)
    .gte("kickoff_at", before)
    .lte("kickoff_at", after);

  if (nearby && nearby.length > 0) {
    conflicts.push(`Already officiating ${nearby.length} match within ±48h`);
  }

  // Rotation: officiated either club in last 14 days
  const since = new Date(kickoff.getTime() - 14 * 86400 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("matches")
    .select("id, home_club_id, away_club_id, kickoff_at")
    .eq("referee_id", refereeId)
    .gte("kickoff_at", since)
    .lt("kickoff_at", kickoff.toISOString());

  const repeats = (recent ?? []).filter(
    (m) =>
      m.home_club_id === match.home_club_id ||
      m.away_club_id === match.home_club_id ||
      m.home_club_id === match.away_club_id ||
      m.away_club_id === match.away_club_id,
  );
  if (repeats.length > 0) {
    conflicts.push(`Officiated participating club within last 14 days (rotation rule)`);
  }

  return { ok: conflicts.length === 0, conflicts };
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}
