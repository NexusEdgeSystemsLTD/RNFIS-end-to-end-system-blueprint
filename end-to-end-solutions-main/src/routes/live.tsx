import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, Trophy, Calendar } from "lucide-react";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live Fixtures & Standings — Rwanda Premier League" },
      { name: "description", content: "Live scores, fixtures, and standings from the Rwanda Premier League. Follow your club in real time." },
      { property: "og:title", content: "Live Fixtures & Standings — Rwanda Premier League" },
      { property: "og:description", content: "Live scores and standings from the Rwanda Premier League." },
    ],
  }),
  component: LivePublic,
});

type Match = {
  id: string; match_code: string; kickoff_at: string; venue: string;
  status: string; current_minute: number; home_score: number; away_score: number;
  home_club_id: string; away_club_id: string;
};
type Club = { id: string; name: string; short_code: string; primary_color: string | null };

function LivePublic() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [clubs, setClubs] = useState<Record<string, Club>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [{ data: mt }, { data: cl }] = await Promise.all([
        supabase.from("matches").select("*").order("kickoff_at", { ascending: false }).limit(50),
        supabase.from("clubs").select("id, name, short_code, primary_color"),
      ]);
      if (!mounted) return;
      setMatches((mt as Match[]) ?? []);
      const map: Record<string, Club> = {};
      (cl ?? []).forEach((c: any) => (map[c.id] = c));
      setClubs(map);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("public-live-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, (payload) => {
        setMatches((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((m) => m.id !== (payload.old as any).id);
          const next = payload.new as Match;
          const idx = prev.findIndex((m) => m.id === next.id);
          if (idx >= 0) { const copy = [...prev]; copy[idx] = { ...copy[idx], ...next }; return copy; }
          return [next, ...prev];
        });
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, []);

  const live = matches.filter((m) => m.status === "live" || m.status === "halftime");
  const upcoming = matches.filter((m) => m.status === "scheduled").sort((a, b) => +new Date(a.kickoff_at) - +new Date(b.kickoff_at));
  const completed = matches.filter((m) => m.status === "completed");

  // Standings
  const stats: Record<string, any> = {};
  Object.values(clubs).forEach((c) => (stats[c.id] = { ...c, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0 }));
  completed.forEach((m) => {
    const h = stats[m.home_club_id], a = stats[m.away_club_id];
    if (!h || !a) return;
    h.P++; a.P++; h.GF += m.home_score; h.GA += m.away_score; a.GF += m.away_score; a.GA += m.home_score;
    if (m.home_score > m.away_score) { h.W++; h.Pts += 3; a.L++; }
    else if (m.home_score < m.away_score) { a.W++; a.Pts += 3; h.L++; }
    else { h.D++; a.D++; h.Pts++; a.Pts++; }
  });
  const standings = Object.values(stats).sort((x: any, y: any) => y.Pts - x.Pts || (y.GF - y.GA) - (x.GF - x.GA));

  const MatchRow = ({ m, showScore = true }: { m: Match; showScore?: boolean }) => {
    const home = clubs[m.home_club_id]; const away = clubs[m.away_club_id];
    return (
      <div className="flex items-center gap-3 p-3 border-b border-border last:border-0">
        <div className="text-xs font-mono text-muted-foreground w-20 shrink-0">{m.match_code}</div>
        <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="text-right text-sm font-medium truncate">{home?.name ?? "—"}</div>
          {showScore && (m.status === "live" || m.status === "halftime" || m.status === "completed") ? (
            <div className="font-mono font-bold text-lg px-3">{m.home_score} - {m.away_score}</div>
          ) : (
            <div className="text-xs text-muted-foreground px-3">vs</div>
          )}
          <div className="text-left text-sm font-medium truncate">{away?.name ?? "—"}</div>
        </div>
        <div className="w-32 text-right text-xs text-muted-foreground shrink-0">
          {m.status === "live" && <Badge variant="destructive" className="animate-pulse text-[10px]">{m.current_minute}'</Badge>}
          {m.status === "halftime" && <Badge variant="secondary" className="text-[10px]">HT</Badge>}
          {m.status === "scheduled" && new Date(m.kickoff_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          {m.status === "completed" && <span className="text-[10px] uppercase">FT</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Rwanda Premier League</h1>
            <p className="text-xs text-muted-foreground">Live fixtures & standings · Public view</p>
          </div>
          <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">Officials sign in →</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {loading && <div className="text-sm text-muted-foreground p-12 text-center">Loading…</div>}

        {!loading && (
          <>
            {live.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Radio className="h-4 w-4 text-destructive animate-pulse" /> Live now
                </h2>
                <Card><CardContent className="p-0">{live.map((m) => <MatchRow key={m.id} m={m} />)}</CardContent></Card>
              </section>
            )}

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Upcoming fixtures
              </h2>
              <Card><CardContent className="p-0">
                {upcoming.length === 0
                  ? <div className="p-8 text-center text-sm text-muted-foreground">No upcoming fixtures.</div>
                  : upcoming.slice(0, 10).map((m) => <MatchRow key={m.id} m={m} />)}
              </CardContent></Card>
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4" /> Standings
              </h2>
              <Card><CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-xs text-muted-foreground uppercase">
                    <th className="p-3 text-left w-10">#</th>
                    <th className="text-left">Club</th>
                    {["P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((h) => <th key={h} className="p-2 text-center font-mono w-12">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {standings.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No completed matches yet.</td></tr>}
                    {standings.map((c: any, i: number) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="p-3 font-mono text-muted-foreground">{i + 1}</td>
                        <td className="font-medium">{c.name}</td>
                        {[c.P, c.W, c.D, c.L, c.GF, c.GA, c.GF - c.GA, c.Pts].map((v, j) => (
                          <td key={j} className={`p-2 text-center font-mono ${j === 7 ? "font-bold text-primary" : ""}`}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent></Card>
            </section>

            {completed.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent results</h2>
                <Card><CardContent className="p-0">{completed.slice(0, 8).map((m) => <MatchRow key={m.id} m={m} />)}</CardContent></Card>
              </section>
            )}
          </>
        )}

        <footer className="text-center text-xs text-muted-foreground py-6">
          RNFIS · Ministry of Sports & FERWAFA
        </footer>
      </main>
    </div>
  );
}
