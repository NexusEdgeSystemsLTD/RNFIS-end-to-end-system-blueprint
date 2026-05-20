import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Trophy, Users, Gavel, AlertCircle, ArrowUpRight, Wifi } from "lucide-react";
import { Flag } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/")({
  component: CommandDashboard,
});

interface Stats {
  totalClubs: number;
  totalPlayers: number;
  totalReferees: number;
  liveMatches: number;
  upcomingMatches: number;
  activeDiscipline: number;
  recentMatches: any[];
  liveMatchList: any[];
}

function CommandDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [presence, setPresence] = useState<{ email: string; role: string }[]>([]);
  const { profile, roles } = useAuth();

  // Realtime presence on Command channel
  useEffect(() => {
    if (!profile) return;
    const channel = supabase.channel("command-presence", {
      config: { presence: { key: profile.user_id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ email: string; role: string }>();
        const users = Object.values(state).flat().map((u: any) => ({ email: u.email, role: u.role }));
        setPresence(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ email: profile.email, role: roles[0] ?? "public_viewer", at: Date.now() });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [profile, roles]);

  useEffect(() => {
    (async () => {
      const [clubs, players, refs, live, upcoming, disc, recent, liveList] = await Promise.all([
        supabase.from("clubs").select("id", { count: "exact", head: true }),
        supabase.from("players").select("id", { count: "exact", head: true }),
        supabase.from("referees").select("id", { count: "exact", head: true }),
        supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "live"),
        supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
        supabase.from("discipline_records").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase
          .from("matches")
          .select("id, match_code, status, home_score, away_score, kickoff_at, home_club:home_club_id(name, short_code), away_club:away_club_id(name, short_code), venue")
          .order("kickoff_at", { ascending: false })
          .limit(6),
        supabase
          .from("matches")
          .select("id, match_code, status, home_score, away_score, current_minute, home_club:home_club_id(name, short_code, primary_color), away_club:away_club_id(name, short_code, primary_color), venue")
          .eq("status", "live"),
      ]);

      setStats({
        totalClubs: clubs.count ?? 0,
        totalPlayers: players.count ?? 0,
        totalReferees: refs.count ?? 0,
        liveMatches: live.count ?? 0,
        upcomingMatches: upcoming.count ?? 0,
        activeDiscipline: disc.count ?? 0,
        recentMatches: recent.data ?? [],
        liveMatchList: liveList.data ?? [],
      });
    })();
  }, []);

  const cards = [
    { label: "Registered Clubs", value: stats?.totalClubs, icon: Trophy, accent: "text-primary" },
    { label: "Licensed Players", value: stats?.totalPlayers, icon: Users, accent: "text-info" },
    { label: "Active Referees", value: stats?.totalReferees, icon: Flag, accent: "text-warning" },
    { label: "Live Matches", value: stats?.liveMatches, icon: Activity, accent: "text-destructive", live: !!stats?.liveMatches },
    { label: "Upcoming Fixtures", value: stats?.upcomingMatches, icon: Trophy, accent: "text-success" },
    { label: "Active Sanctions", value: stats?.activeDiscipline, icon: Gavel, accent: "text-warning" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Command Overview"
          subtitle="Ministry intelligence dashboard · Real-time governance signals"
        />
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card/50">
          <Wifi className="h-4 w-4 text-success" />
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase">Live operators</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono text-sm font-bold">{presence.length}</span>
              <div className="flex -space-x-1">
                {presence.slice(0, 5).map((p, i) => (
                  <div key={i} title={`${p.email} · ${p.role}`}
                       className="h-5 w-5 rounded-full bg-primary/80 border border-background grid place-items-center text-[9px] font-bold text-primary-foreground">
                    {p.email.charAt(0).toUpperCase()}
                  </div>
                ))}
                {presence.length > 5 && <span className="text-[10px] text-muted-foreground ml-1">+{presence.length - 5}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {cards.map((c) => (
          <Card key={c.label} className="panel">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <c.icon className={`h-4 w-4 ${c.accent}`} />
                {c.live && <span className="h-2 w-2 rounded-full bg-destructive live-dot" />}
              </div>
              <div className="text-2xl font-bold font-mono">{c.value ?? "—"}</div>
              <div className="text-xs text-muted-foreground tracking-wide uppercase mt-1">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live matches strip */}
      {stats && stats.liveMatchList.length > 0 && (
        <Card className="panel mb-6 border-destructive/40">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-destructive live-dot" />
              LIVE NOW
            </CardTitle>
            <Link to="/app/matches">
              <Button variant="ghost" size="sm" className="text-xs">View all <ArrowUpRight className="h-3 w-3 ml-1" /></Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.liveMatchList.map((m: any) => (
              <Link key={m.id} to="/app/matches/$matchId" params={{ matchId: m.id }} className="block">
                <div className="flex items-center justify-between p-3 rounded-md bg-card hover:bg-accent transition-colors border border-border">
                  <div className="flex items-center gap-4">
                    <Badge variant="destructive" className="font-mono text-[10px]">
                      {m.current_minute}'
                    </Badge>
                    <div className="font-medium">{m.home_club?.name} <span className="text-muted-foreground">vs</span> {m.away_club?.name}</div>
                  </div>
                  <div className="font-mono text-xl font-bold">{m.home_score} - {m.away_score}</div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="panel lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Recent Match Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats?.recentMatches.map((m: any) => (
              <Link key={m.id} to="/app/matches/$matchId" params={{ matchId: m.id }}>
                <div className="flex items-center justify-between p-3 rounded-md hover:bg-accent transition-colors">
                  <div>
                    <div className="text-sm font-medium">{m.home_club?.name} vs {m.away_club?.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{m.match_code} · {m.venue}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{m.home_score}-{m.away_score}</span>
                    <Badge variant={m.status === "live" ? "destructive" : m.status === "completed" ? "secondary" : "outline"} className="text-[10px] uppercase">
                      {m.status}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" /> System Signals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Database</span><Badge variant="outline" className="text-success border-success/40">Operational</Badge></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Auth Service</span><Badge variant="outline" className="text-success border-success/40">Operational</Badge></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Audit Ledger</span><Badge variant="outline" className="text-success border-success/40">Sealed</Badge></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">VAR Sync</span><Badge variant="outline" className="text-success border-success/40">Linked</Badge></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Data Sovereignty</span><Badge variant="outline" className="text-success border-success/40">KGL-DC1</Badge></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
