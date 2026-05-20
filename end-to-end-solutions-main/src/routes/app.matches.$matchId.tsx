import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Plus, Goal, Square, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { VarReviewDialog } from "@/components/VarReviewDialog";

export const Route = createFileRoute("/app/matches/$matchId")({
  component: MatchDetail,
});

const EVENT_TYPES = [
  { v: "goal", label: "Goal", icon: Goal },
  { v: "penalty_goal", label: "Penalty Goal", icon: Goal },
  { v: "own_goal", label: "Own Goal", icon: Goal },
  { v: "yellow_card", label: "Yellow Card", icon: Square },
  { v: "red_card", label: "Red Card", icon: Square },
  { v: "substitution", label: "Substitution", icon: AlertCircle },
  { v: "var_review", label: "VAR Review", icon: AlertCircle },
  { v: "halftime", label: "Half Time", icon: AlertCircle },
  { v: "fulltime", label: "Full Time", icon: AlertCircle },
];

function MatchDetail() {
  const { matchId } = Route.useParams();
  const { hasAnyRole } = useAuth();
  const [match, setMatch] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [evType, setEvType] = useState("goal");
  const [evMinute, setEvMinute] = useState("");
  const [evClubId, setEvClubId] = useState<string>("");
  const [evPlayerId, setEvPlayerId] = useState<string>("");
  const [evNotes, setEvNotes] = useState("");

  const canEdit = hasAnyRole(["ministry_admin", "ferwafa_admin", "referee", "var_officer"]);

  const load = useCallback(async () => {
    const [{ data: m }, { data: ev }] = await Promise.all([
      supabase
        .from("matches")
        .select("*, home_club:home_club_id(*), away_club:away_club_id(*), referee:referee_id(full_name, license_number)")
        .eq("id", matchId)
        .single(),
      supabase
        .from("match_events")
        .select("*, player:player_id(full_name, jersey_number), club:club_id(short_code, name)")
        .eq("match_id", matchId)
        .order("minute", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);
    setMatch(m);
    setEvents(ev ?? []);
    if (m) {
      const { data: pl } = await supabase
        .from("players")
        .select("id, full_name, jersey_number, club_id")
        .in("club_id", [m.home_club_id, m.away_club_id]);
      setPlayers(pl ?? []);
    }
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    load();
    // Realtime
    const ch = supabase
      .channel(`match-${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, load]);

  const addEvent = async () => {
    const minute = parseInt(evMinute);
    if (isNaN(minute) || minute < 0) { toast.error("Enter a valid minute"); return; }
    const isScoring = evType === "goal" || evType === "penalty_goal" || evType === "own_goal";
    const isCard = evType === "yellow_card" || evType === "red_card";
    if (isScoring && !evClubId) { toast.error("Select scoring club"); return; }
    if (isCard && !evPlayerId) { toast.error("Select player for card"); return; }

    const { error } = await supabase.from("match_events").insert({
      match_id: matchId,
      minute,
      event_type: evType as any,
      club_id: evClubId || null,
      player_id: evPlayerId || null,
      notes: evNotes || null,
    });

    if (error) { toast.error(error.message); return; }

    // Update score / status
    if (isScoring && match) {
      const isHome = evClubId === match.home_club_id;
      const isOwnGoal = evType === "own_goal";
      const homeInc = (isHome && !isOwnGoal) || (!isHome && isOwnGoal) ? 1 : 0;
      const awayInc = (!isHome && !isOwnGoal) || (isHome && isOwnGoal) ? 1 : 0;
      await supabase.from("matches").update({
        home_score: match.home_score + homeInc,
        away_score: match.away_score + awayInc,
        current_minute: Math.max(match.current_minute, minute),
      }).eq("id", matchId);
      // Increment player goals
      if (evPlayerId && !isOwnGoal) {
        const { data: pl } = await supabase.from("players").select("goals").eq("id", evPlayerId).single();
        if (pl) await supabase.from("players").update({ goals: (pl.goals ?? 0) + 1 }).eq("id", evPlayerId);
      }
    } else if (match) {
      const updates: any = { current_minute: Math.max(match.current_minute, minute) };
      if (evType === "halftime") updates.status = "halftime";
      if (evType === "fulltime") updates.status = "completed";
      await supabase.from("matches").update(updates).eq("id", matchId);
    }

    // Cards: counters + red-card auto-suspension handled by DB trigger trg_red_card_suspension
    if (isCard) {
      toast.success(evType === "red_card" ? "Red card logged · auto-suspension created" : "Yellow card logged");
    } else {
      toast.success("Event recorded");
    }

    setEvMinute(""); setEvPlayerId(""); setEvClubId(""); setEvNotes("");
  };

  const setLive = async () => {
    await supabase.from("matches").update({ status: "live", current_minute: 0 }).eq("id", matchId);
    await supabase.from("match_events").insert({ match_id: matchId, minute: 0, event_type: "kickoff" });
    toast.success("Match is live");
  };

  if (loading || !match) return <div className="p-6 text-muted-foreground">Loading match…</div>;

  const eligiblePlayers = evClubId ? players.filter((p) => p.club_id === evClubId) : players;

  return (
    <div className="p-6 space-y-6">
      <Link to="/app/matches"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> All matches</Button></Link>

      <Card className="panel">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <code className="text-xs font-mono text-muted-foreground">{match.match_code} · MD{match.matchday}</code>
            <Badge variant={match.status === "live" ? "destructive" : match.status === "completed" ? "secondary" : "outline"} className="uppercase">
              {match.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-current mr-1 live-dot" />}
              {match.status} {match.status === "live" && `· ${match.current_minute}'`}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-right">
              <div className="text-xl font-bold">{match.home_club.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{match.home_club.short_code}</div>
            </div>
            <div className="text-center font-mono text-5xl font-bold tabular-nums">
              {match.home_score} <span className="text-muted-foreground text-3xl">-</span> {match.away_score}
            </div>
            <div className="text-left">
              <div className="text-xl font-bold">{match.away_club.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{match.away_club.short_code}</div>
            </div>
          </div>
          <div className="text-center text-xs text-muted-foreground mt-4">
            {new Date(match.kickoff_at).toLocaleString("en-RW")} · {match.venue} · Referee: {match.referee?.full_name ?? "TBD"}
          </div>
          <div className="flex justify-center gap-2 mt-4">
            {canEdit && match.status === "scheduled" && (
              <Button onClick={setLive}>Start Match (Go Live)</Button>
            )}
            {canEdit && (match.status === "live" || match.status === "halftime" || match.status === "completed") && (
              <VarReviewDialog matchId={matchId} defaultMinute={match.current_minute} onSubmitted={load} />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="panel lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Event Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 && <div className="text-sm text-muted-foreground">No events recorded yet.</div>}
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-accent">
                <div className="font-mono text-sm text-primary w-12 shrink-0 text-right">{e.minute}'</div>
                <Badge variant="outline" className="text-[10px] uppercase shrink-0">{e.event_type.replace("_", " ")}</Badge>
                <div className="flex-1 text-sm min-w-0">
                  {e.player && <span className="font-medium">#{e.player.jersey_number} {e.player.full_name} </span>}
                  {e.club && <span className="text-muted-foreground">({e.club.short_code})</span>}
                  {e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {canEdit && (
          <Card className="panel">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> Record Event</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select value={evType} onValueChange={setEvType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" placeholder="Minute" value={evMinute} onChange={(e) => setEvMinute(e.target.value)} min={0} max={130} />
              <Select value={evClubId} onValueChange={(v) => { setEvClubId(v); setEvPlayerId(""); }}>
                <SelectTrigger><SelectValue placeholder="Club" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={match.home_club_id}>{match.home_club.name}</SelectItem>
                  <SelectItem value={match.away_club_id}>{match.away_club.name}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={evPlayerId} onValueChange={setEvPlayerId}>
                <SelectTrigger><SelectValue placeholder="Player (optional)" /></SelectTrigger>
                <SelectContent>
                  {eligiblePlayers.map((p) => <SelectItem key={p.id} value={p.id}>#{p.jersey_number} {p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Notes" value={evNotes} onChange={(e) => setEvNotes(e.target.value)} />
              <Button onClick={addEvent} className="w-full">Record</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
