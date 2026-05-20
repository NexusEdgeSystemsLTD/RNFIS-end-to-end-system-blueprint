import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { buildLeagueTable, performanceIndex, computeConductScore, type ClubRow } from "@/lib/engines";

export const Route = createFileRoute("/app/rankings")({ component: Rankings });

function FormStrip({ form }: { form: string[] }) {
  const colors: Record<string, string> = { W: "bg-success text-white", D: "bg-warning text-black", L: "bg-destructive text-white" };
  return (
    <div className="flex gap-1 justify-center">
      {form.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
      {form.map((r, i) => (
        <span key={i} className={`h-5 w-5 rounded-sm grid place-items-center text-[10px] font-bold ${colors[r] ?? "bg-muted"}`}>{r}</span>
      ))}
    </div>
  );
}

function Rankings() {
  const [table, setTable] = useState<ClubRow[]>([]);
  const [scorers, setScorers] = useState<any[]>([]);
  const [perfIdx, setPerfIdx] = useState<any[]>([]);
  const [referees, setReferees] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: clubs }, { data: matches }, { data: players }, { data: refs }] = await Promise.all([
        supabase.from("clubs").select("id, name, short_code, points_deduction"),
        supabase.from("matches").select("home_club_id, away_club_id, home_score, away_score, status, kickoff_at"),
        supabase.from("players").select("id, full_name, club_id, goals, appearances, yellow_cards, red_cards, position"),
        supabase.from("referees").select("id, full_name, level, matches_officiated, performance_rating, license_expiry, active").eq("active", true),
      ]);

      setTable(buildLeagueTable((clubs ?? []) as any, (matches ?? []) as any));

      const sortedScorers = [...(players ?? [])]
        .filter((p) => (p.goals ?? 0) > 0)
        .sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0))
        .slice(0, 20);
      setScorers(sortedScorers);

      const idx = (players ?? [])
        .map((p) => ({ ...p, score: performanceIndex(p as any), conduct: computeConductScore(p as any) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      setPerfIdx(idx);

      setReferees((refs ?? []).sort((a, b) => (b.performance_rating ?? 0) - (a.performance_rating ?? 0)));
    })();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Performance Analytics" subtitle="League standings, top scorers, player index, referee rankings — computed from live data" />

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">League Table</TabsTrigger>
          <TabsTrigger value="scorers">Top Scorers</TabsTrigger>
          <TabsTrigger value="players">Player Index</TabsTrigger>
          <TabsTrigger value="refs">Referee Rankings</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground uppercase">
                <th className="p-3 text-left">#</th><th className="text-left">Club</th>
                {["P","W","D","L","GF","GA","GD","Pts"].map((h) => <th key={h} className="p-2 text-center font-mono">{h}</th>)}
                <th className="p-2 text-center">Form</th>
              </tr></thead>
              <tbody>{table.map((c, i) => {
                const zone = i < 3 ? "border-l-2 border-success" : i >= table.length - 3 && table.length > 6 ? "border-l-2 border-destructive" : "";
                return (
                  <tr key={c.id} className={`border-b border-border/50 hover:bg-accent ${zone}`}>
                    <td className="p-3 font-mono text-muted-foreground">{i+1}</td>
                    <td className="font-medium">{c.name}{c.points_deduction > 0 && <span className="text-destructive">*</span>}</td>
                    {[c.P,c.W,c.D,c.L,c.GF,c.GA,c.GD,c.Pts].map((v,j) => <td key={j} className={`p-2 text-center font-mono ${j===7?"font-bold text-primary":""}`}>{v}</td>)}
                    <td className="p-2"><FormStrip form={c.form} /></td>
                  </tr>
                );
              })}</tbody>
            </table>
            {table.some((c) => c.points_deduction > 0) && <div className="p-3 text-xs text-muted-foreground">* Points deducted</div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="scorers">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground uppercase">
                <th className="p-3 text-left">#</th><th className="text-left">Player</th>
                <th className="text-left">Position</th><th className="text-center">Apps</th>
                <th className="text-center">Goals</th><th className="text-center">Rate</th>
              </tr></thead>
              <tbody>{scorers.map((p, i) => {
                const tone = i === 0 ? "text-yellow-500" : i === 1 ? "text-zinc-400" : i === 2 ? "text-amber-700" : "";
                return (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-accent">
                    <td className={`p-3 font-mono font-bold ${tone}`}>{i+1}</td>
                    <td className="font-medium">{p.full_name}</td>
                    <td><Badge variant="outline">{p.position}</Badge></td>
                    <td className="text-center font-mono">{p.appearances}</td>
                    <td className="text-center font-mono font-bold">{p.goals}</td>
                    <td className="text-center font-mono text-muted-foreground">{p.appearances > 0 ? (p.goals / p.appearances).toFixed(2) : "—"}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="players">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground uppercase">
                <th className="p-3 text-left">#</th><th className="text-left">Player</th>
                <th className="text-center">Goals</th><th className="text-center">Apps</th>
                <th className="text-center">Conduct</th><th className="text-left">Index</th>
              </tr></thead>
              <tbody>{perfIdx.map((p, i) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-accent">
                  <td className="p-3 font-mono text-muted-foreground">{i+1}</td>
                  <td className="font-medium">{p.full_name}</td>
                  <td className="text-center font-mono">{p.goals}</td>
                  <td className="text-center font-mono">{p.appearances}</td>
                  <td className="text-center font-mono">{p.conduct.toFixed(2)}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${p.score}%` }} />
                      </div>
                      <span className="font-mono font-bold">{p.score}</span>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
            <div className="p-3 text-xs text-muted-foreground border-t">Index = Goals 30% + Apps 15% + Minutes 15% + Conduct 20% + Assists 20%</div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="refs">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground uppercase">
                <th className="p-3 text-left">#</th><th className="text-left">Referee</th>
                <th className="text-left">Level</th><th className="text-center">Matches</th>
                <th className="text-center">Rating</th><th className="text-left">Band</th>
                <th className="text-left">License Expiry</th>
              </tr></thead>
              <tbody>{referees.map((r, i) => {
                const rating = r.performance_rating ?? 0;
                const band = rating >= 9 ? "Elite" : rating >= 7.5 ? "Proficient" : rating >= 6 ? "Developing" : "Review";
                const bandColor = band === "Elite" ? "bg-success/20 text-success" : band === "Proficient" ? "bg-primary/20 text-primary" : band === "Developing" ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive";
                const exp = r.license_expiry ? new Date(r.license_expiry) : null;
                const days = exp ? Math.ceil((+exp - Date.now()) / 86400000) : null;
                const expColor = days == null ? "text-muted-foreground" : days < 30 ? "text-destructive" : days < 90 ? "text-warning" : "text-foreground";
                return (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-accent">
                    <td className="p-3 font-mono text-muted-foreground">{i+1}</td>
                    <td className="font-medium">{r.full_name}</td>
                    <td><Badge variant="outline">{r.level}</Badge></td>
                    <td className="text-center font-mono">{r.matches_officiated}</td>
                    <td className="text-center font-mono font-bold">{rating.toFixed(2)}</td>
                    <td><span className={`text-xs font-medium px-2 py-0.5 rounded ${bandColor}`}>{band}</span></td>
                    <td className={`text-xs font-mono ${expColor}`}>{exp ? exp.toLocaleDateString() : "—"}{days != null && days < 90 && ` (${days}d)`}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
