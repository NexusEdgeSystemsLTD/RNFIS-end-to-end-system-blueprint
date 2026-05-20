import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { Plus } from "lucide-react";
import { CreateMatchDialog } from "@/components/CreateMatchDialog";

export const Route = createFileRoute("/app/matches/")({
  component: MatchesList,
});

function MatchesList() {
  const { hasAnyRole } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "live" | "scheduled" | "completed">("all");
  const [open, setOpen] = useState(false);

  const canCreate = hasAnyRole(["ministry_admin", "ferwafa_admin"]);

  const load = async () => {
    let q = supabase
      .from("matches")
      .select("*, home_club:home_club_id(name, short_code, primary_color), away_club:away_club_id(name, short_code, primary_color), referee:referee_id(full_name)")
      .order("kickoff_at", { ascending: false });
    if (tab !== "all") q = q.eq("status", tab);
    const { data } = await q;
    setMatches(data ?? []);
  };

  useEffect(() => { load(); }, [tab]);

  const filtered = matches.filter((m) =>
    !search ||
    m.match_code.toLowerCase().includes(search.toLowerCase()) ||
    m.home_club?.name.toLowerCase().includes(search.toLowerCase()) ||
    m.away_club?.name.toLowerCase().includes(search.toLowerCase()) ||
    m.venue.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Match Intelligence"
        subtitle="Live event entry, fixtures, and historical match records"
        actions={canCreate ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Fixture</Button> : null}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="scheduled">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      <Input placeholder="Search by code, club, or venue…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-md" />

      <div className="grid gap-3">
        {filtered.map((m) => (
          <Link key={m.id} to="/app/matches/$matchId" params={{ matchId: m.id }}>
            <Card className="panel hover:border-primary/40 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    <code className="text-xs text-muted-foreground font-mono">{m.match_code}</code>
                    <Badge variant={m.status === "live" ? "destructive" : m.status === "completed" ? "secondary" : "outline"} className="text-[10px] uppercase">
                      {m.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-current mr-1 live-dot" />}
                      {m.status} {m.status === "live" && `· ${m.current_minute}'`}
                    </Badge>
                    <span className="text-xs text-muted-foreground">MD{m.matchday}</span>
                  </div>
                  <div className="font-semibold">{m.home_club?.name} <span className="text-muted-foreground font-normal">vs</span> {m.away_club?.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(m.kickoff_at).toLocaleString("en-RW", { dateStyle: "medium", timeStyle: "short" })} · {m.venue} · Ref: {m.referee?.full_name ?? "—"}
                  </div>
                </div>
                <div className="font-mono text-2xl font-bold tabular-nums">
                  {m.home_score} <span className="text-muted-foreground text-base">-</span> {m.away_score}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No matches found.</div>
        )}
      </div>

      <CreateMatchDialog open={open} onOpenChange={setOpen} onCreated={load} />
    </div>
  );
}
