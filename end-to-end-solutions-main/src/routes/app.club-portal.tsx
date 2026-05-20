import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buildLeagueTable, conductBand, computeConductScore } from "@/lib/engines";
import { AlertCircle, Trophy, Users } from "lucide-react";

export const Route = createFileRoute("/app/club-portal")({ component: ClubPortal });

function ClubPortal() {
  const { profile } = useAuth();
  const clubId = profile?.club_id;
  const [club, setClub] = useState<any>(null);
  const [squad, setSquad] = useState<any[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [discipline, setDiscipline] = useState<any[]>([]);
  const [position, setPosition] = useState<number | null>(null);
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => {
    if (!clubId) return;
    (async () => {
      const [{ data: c }, { data: players }, { data: matches }, { data: allMatches }, { data: clubs }, { data: disc }, { data: documents }] = await Promise.all([
        supabase.from("clubs").select("*").eq("id", clubId).maybeSingle(),
        supabase.from("players").select("*").eq("club_id", clubId).order("jersey_number"),
        supabase.from("matches").select("*, home:home_club_id(name, short_code), away:away_club_id(name, short_code)").or(`home_club_id.eq.${clubId},away_club_id.eq.${clubId}`).order("kickoff_at"),
        supabase.from("matches").select("home_club_id, away_club_id, home_score, away_score, status, kickoff_at"),
        supabase.from("clubs").select("id, name, short_code, points_deduction"),
        supabase.from("discipline_records").select("*, player:player_id(full_name)").eq("club_id", clubId).eq("status", "active"),
        supabase.from("club_documents").select("*").eq("club_id", clubId),
      ]);
      setClub(c);
      setSquad(players ?? []);
      const now = Date.now();
      setFixtures((matches ?? []).filter((m) => +new Date(m.kickoff_at) > now).slice(0, 5));
      setResults((matches ?? []).filter((m) => m.status === "completed").slice(-5).reverse());
      setDiscipline(disc ?? []);
      setDocs(documents ?? []);
      const table = buildLeagueTable((clubs ?? []) as any, (allMatches ?? []) as any);
      const idx = table.findIndex((t) => t.id === clubId);
      setPosition(idx >= 0 ? idx + 1 : null);
    })();
  }, [clubId]);

  if (!clubId) {
    return <div className="p-6"><PageHeader title="Club Portal" /><Card><CardContent className="p-8 text-center text-muted-foreground">No club assigned to your profile. Contact a Ministry administrator to link your account to a club.</CardContent></Card></div>;
  }
  if (!club) return <div className="p-6 text-muted-foreground">Loading...</div>;

  const byPosition = squad.reduce((acc: Record<string, number>, p) => { acc[p.position] = (acc[p.position] ?? 0) + 1; return acc; }, {});
  const compliancePct = docs.length === 0 ? 0 : Math.round((docs.filter((d) => d.status === "complete").length / docs.length) * 100);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={club.name} subtitle={`${club.division} · ${club.city ?? "—"} · ${club.short_code}`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">League position</div>
          <div className="text-2xl font-bold mt-1 font-mono flex items-center gap-2"><Trophy className="h-5 w-5 text-warning" /> {position ?? "—"}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">Squad size</div>
          <div className="text-2xl font-bold mt-1 font-mono flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> {squad.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">Active suspensions</div>
          <div className="text-2xl font-bold mt-1 font-mono flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" /> {discipline.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">Licensing compliance</div>
          <div className="text-2xl font-bold mt-1 font-mono">{compliancePct}%</div>
        </CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Squad — by position</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 text-xs">
              {["GK","DEF","MID","FWD"].map((pos) => (
                <div key={pos} className="flex-1 text-center p-2 bg-muted rounded">
                  <div className="font-bold text-lg font-mono">{byPosition[pos] ?? 0}</div>
                  <div className="text-muted-foreground">{pos}</div>
                </div>
              ))}
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {squad.map((p) => {
                const conduct = computeConductScore(p);
                const band = conductBand(conduct);
                return (
                  <div key={p.id} className="flex items-center justify-between text-sm p-2 hover:bg-accent rounded">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground w-6">{p.jersey_number ?? "—"}</span>
                      <span className="font-medium">{p.full_name}</span>
                      <Badge variant="outline" className="text-[10px]">{p.position}</Badge>
                    </div>
                    <span className={`text-xs font-mono ${band.color}`}>{conduct.toFixed(2)} · {band.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Discipline noticeboard</CardTitle></CardHeader>
          <CardContent>
            {discipline.length === 0 ? (
              <div className="text-sm text-muted-foreground">No active suspensions.</div>
            ) : discipline.map((d) => (
              <div key={d.id} className="border-b border-border/50 py-2">
                <div className="font-medium text-sm">{d.player?.full_name ?? "Unknown"}</div>
                <div className="text-xs text-muted-foreground">{d.case_number} · {d.suspension_matches} match(es)</div>
                <div className="text-xs">{d.reason}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Next 5 fixtures</CardTitle></CardHeader>
          <CardContent>
            {fixtures.length === 0 ? <div className="text-sm text-muted-foreground">No upcoming fixtures.</div> :
              fixtures.map((m) => {
                const home = m.home_club_id === clubId;
                const opp = home ? m.away?.name : m.home?.name;
                return (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                    <div>
                      <div className="font-medium">{home ? "vs" : "@"} {opp}</div>
                      <div className="text-xs text-muted-foreground">{new Date(m.kickoff_at).toLocaleString()}</div>
                    </div>
                    <Badge variant="outline">{m.match_code}</Badge>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider">Recent results</CardTitle></CardHeader>
          <CardContent>
            {results.length === 0 ? <div className="text-sm text-muted-foreground">No completed matches.</div> :
              results.map((m) => {
                const home = m.home_club_id === clubId;
                const opp = home ? m.away?.name : m.home?.name;
                const myScore = home ? m.home_score : m.away_score;
                const oppScore = home ? m.away_score : m.home_score;
                const result = myScore > oppScore ? "W" : myScore < oppScore ? "L" : "D";
                const color = result === "W" ? "text-success" : result === "L" ? "text-destructive" : "text-warning";
                return (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                    <div>
                      <div className="font-medium">{home ? "vs" : "@"} {opp}</div>
                      <div className="text-xs text-muted-foreground">{new Date(m.kickoff_at).toLocaleDateString()}</div>
                    </div>
                    <div className={`font-mono font-bold ${color}`}>{myScore}-{oppScore} {result}</div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
