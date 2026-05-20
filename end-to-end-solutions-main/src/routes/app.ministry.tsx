import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ministry")({ component: MinistryBI });

function MinistryBI() {
  const [kpi, setKpi] = useState<any>({});
  const [trend, setTrend] = useState<{ month: string; yellow: number; red: number }[]>([]);
  const [briefing, setBriefing] = useState<string>("");
  const [loadingBrief, setLoadingBrief] = useState(false);

  useEffect(() => {
    (async () => {
      const [
        { count: players }, { count: refs }, { count: clubs }, { count: matches },
        { data: events }, { count: youth },
      ] = await Promise.all([
        supabase.from("players").select("*", { count: "exact", head: true }),
        supabase.from("referees").select("*", { count: "exact", head: true }).eq("active", true),
        supabase.from("clubs").select("*", { count: "exact", head: true }).eq("active", true),
        supabase.from("matches").select("*", { count: "exact", head: true }),
        supabase.from("match_events").select("event_type, created_at"),
        supabase.from("players").select("*", { count: "exact", head: true }).lt("date_of_birth", new Date().toISOString()).gt("date_of_birth", new Date(Date.now() - 17 * 365 * 86400000).toISOString()),
      ]);
      setKpi({ players, refs, clubs, matches, youth, foreign: 0 });

      // Discipline trend by month
      const map: Record<string, { yellow: number; red: number }> = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const key = d.toLocaleString("en", { month: "short", year: "2-digit" });
        map[key] = { yellow: 0, red: 0 };
      }
      (events ?? []).forEach((e) => {
        const d = new Date(e.created_at);
        const key = d.toLocaleString("en", { month: "short", year: "2-digit" });
        if (!map[key]) return;
        if (e.event_type === "yellow_card") map[key].yellow++;
        if (e.event_type === "red_card" || e.event_type === "second_yellow") map[key].red++;
      });
      setTrend(Object.entries(map).map(([month, v]) => ({ month, ...v })));
    })();
  }, []);

  const generateBriefing = async () => {
    setLoadingBrief(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-briefing", {
        body: { kind: "ministry", stats: { kpi, trend } },
      });
      if (error) throw error;
      if ((data as any)?.error) {
        toast.error((data as any).error);
      } else {
        setBriefing((data as any).text);
        toast.success(`Briefing generated (confidence ${((data as any).confidence * 100).toFixed(0)}%)`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "AI briefing failed");
    } finally {
      setLoadingBrief(false);
    }
  };

  const maxTrend = Math.max(1, ...trend.flatMap((t) => [t.yellow, t.red]));

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Ministry BI Dashboard" subtitle="Executive intelligence for Ministry of Sports Rwanda — policy & planning" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { k: "Registered players", v: kpi.players ?? 0 },
          { k: "Licensed referees", v: kpi.refs ?? 0 },
          { k: "Active clubs", v: kpi.clubs ?? 0 },
          { k: "Annual matches", v: kpi.matches ?? 0 },
          { k: "Youth registrations", v: kpi.youth ?? 0 },
          { k: "Economic value (RWF)", v: "₂.₄B" },
        ].map((c) => (
          <Card key={c.k}><CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">{c.k}</div>
            <div className="text-2xl font-bold mt-1 font-mono">{c.v}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">12-month discipline trend</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-48">
            {trend.map((t) => (
              <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end h-40">
                  <div className="flex-1 bg-warning rounded-t" style={{ height: `${(t.yellow / maxTrend) * 100}%` }} title={`${t.yellow} yellow`} />
                  <div className="flex-1 bg-destructive rounded-t" style={{ height: `${(t.red / maxTrend) * 100}%` }} title={`${t.red} red`} />
                </div>
                <div className="text-[10px] text-muted-foreground">{t.month}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-warning rounded-sm" /> Yellow cards</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-destructive rounded-sm" /> Red cards</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">AI policy briefing</CardTitle>
          <Button size="sm" onClick={generateBriefing} disabled={loadingBrief}>
            {loadingBrief ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Generate briefing
          </Button>
        </CardHeader>
        <CardContent>
          {briefing ? (
            <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">{briefing}</div>
          ) : (
            <p className="text-sm text-muted-foreground">Click <em>Generate briefing</em> to produce a 400-word AI policy analysis based on aggregate season data. No individual player PII is sent.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
