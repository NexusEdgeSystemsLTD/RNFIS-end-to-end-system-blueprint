import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Radio } from "lucide-react";

export const Route = createFileRoute("/fixtures")({
  component: PublicFixtures,
  head: () => ({
    meta: [
      { title: "Rwanda Premier League · Fixtures & Standings" },
      { name: "description", content: "Live fixtures, results and standings for the Rwanda Premier League." },
    ],
  }),
});

interface MatchRow {
  id: string; match_code: string; kickoff_at: string; venue: string; status: string;
  home_score: number; away_score: number; current_minute: number;
  home_club_id: string; away_club_id: string;
}

interface ClubRow { id: string; name: string; short_code: string; points_deduction: number; }

function PublicFixtures() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: m }, { data: c }] = await Promise.all([
        supabase.from("matches").select("id, match_code, kickoff_at, venue, status, home_score, away_score, current_minute, home_club_id, away_club_id").order("kickoff_at"),
        supabase.from("clubs").select("id, name, short_code, points_deduction").eq("active", true),
      ]);
      setMatches((m ?? []) as MatchRow[]); setClubs((c ?? []) as ClubRow[]);
    };
    load();
    const channel = supabase
      .channel("public-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const clubMap = useMemo(() => new Map(clubs.map((c) => [c.id, c])), [clubs]);

  const live = matches.filter((m) => m.status === "live" || m.status === "halftime");
  const upcoming = matches.filter((m) => m.status === "scheduled" && new Date(m.kickoff_at) >= new Date()).slice(0, 30);
  const recent = matches.filter((m) => m.status === "completed").slice(-30).reverse();

  // Compute standings
  const table = useMemo(() => {
    const t: Record<string, { id: string; name: string; short: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }> = {};
    clubs.forEach((c) => { t[c.id] = { id: c.id, name: c.name, short: c.short_code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: -(c.points_deduction ?? 0) }; });
    matches.filter((m) => m.status === "completed").forEach((m) => {
      const h = t[m.home_club_id]; const a = t[m.away_club_id]; if (!h || !a) return;
      h.p++; a.p++; h.gf += m.home_score; h.ga += m.away_score; a.gf += m.away_score; a.ga += m.home_score;
      if (m.home_score > m.away_score) { h.w++; a.l++; h.pts += 3; }
      else if (m.home_score < m.away_score) { a.w++; h.l++; a.pts += 3; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    });
    return Object.values(t).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
  }, [matches, clubs]);

  const Fixture = ({ m }: { m: MatchRow }) => {
    const h = clubMap.get(m.home_club_id); const a = clubMap.get(m.away_club_id);
    const isLive = m.status === "live" || m.status === "halftime";
    return (
      <div className="flex items-center justify-between p-3 rounded-md border border-border bg-card">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono text-muted-foreground">{m.match_code} · {new Date(m.kickoff_at).toLocaleString("en-RW", { dateStyle: "medium", timeStyle: "short" })}</div>
          <div className="text-sm font-medium mt-0.5">{h?.name ?? "—"} <span className="text-muted-foreground">vs</span> {a?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{m.venue}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {(m.status === "completed" || isLive) && (
            <div className="text-2xl font-mono tabular-nums">{m.home_score}<span className="text-muted-foreground mx-2">–</span>{m.away_score}</div>
          )}
          {isLive && <Badge variant="destructive" className="uppercase text-[10px] gap-1"><Radio className="h-3 w-3 animate-pulse" /> {m.status === "halftime" ? "HT" : `${m.current_minute}'`}</Badge>}
          {m.status === "completed" && <Badge variant="secondary" className="uppercase text-[10px]">FT</Badge>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground font-bold text-sm">RW</div>
            <div>
              <div className="text-sm font-bold tracking-wider">Rwanda Premier League</div>
              <div className="text-[10px] text-muted-foreground tracking-widest uppercase">Live fixtures · standings · public view</div>
            </div>
          </Link>
          <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">Officials portal →</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {live.length > 0 && (
          <Card className="panel border-destructive/40">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Radio className="h-4 w-4 text-destructive animate-pulse" /> Live now ({live.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {live.map((m) => <Fixture key={m.id} m={m} />)}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="recent">Results ({recent.length})</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="space-y-2 mt-3">
            {upcoming.length === 0 ? <div className="text-sm text-muted-foreground p-12 text-center">No upcoming fixtures scheduled.</div> :
              upcoming.map((m) => <Fixture key={m.id} m={m} />)}
          </TabsContent>
          <TabsContent value="recent" className="space-y-2 mt-3">
            {recent.length === 0 ? <div className="text-sm text-muted-foreground p-12 text-center">No completed matches yet.</div> :
              recent.map((m) => <Fixture key={m.id} m={m} />)}
          </TabsContent>
          <TabsContent value="standings" className="mt-3">
            <Card className="panel"><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4" /> League table</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-2">#</th>
                        <th className="text-left px-4 py-2">Club</th>
                        <th className="text-right px-3 py-2">P</th>
                        <th className="text-right px-3 py-2">W</th>
                        <th className="text-right px-3 py-2">D</th>
                        <th className="text-right px-3 py-2">L</th>
                        <th className="text-right px-3 py-2">GF</th>
                        <th className="text-right px-3 py-2">GA</th>
                        <th className="text-right px-3 py-2">GD</th>
                        <th className="text-right px-4 py-2 font-bold">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.map((row, i) => (
                        <tr key={row.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                          <td className="px-4 py-2">{row.name} <span className="text-xs text-muted-foreground font-mono ml-1">{row.short}</span></td>
                          <td className="text-right px-3 py-2 tabular-nums">{row.p}</td>
                          <td className="text-right px-3 py-2 tabular-nums">{row.w}</td>
                          <td className="text-right px-3 py-2 tabular-nums">{row.d}</td>
                          <td className="text-right px-3 py-2 tabular-nums">{row.l}</td>
                          <td className="text-right px-3 py-2 tabular-nums">{row.gf}</td>
                          <td className="text-right px-3 py-2 tabular-nums">{row.ga}</td>
                          <td className="text-right px-3 py-2 tabular-nums">{row.gf - row.ga}</td>
                          <td className="text-right px-4 py-2 font-bold tabular-nums">{row.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-6 text-xs text-muted-foreground text-center border-t border-border mt-8">
        Public read-only view · Live updates via Supabase realtime · © RNFIS · Rwanda Ministry of Sports & FERWAFA
      </footer>
    </div>
  );
}
