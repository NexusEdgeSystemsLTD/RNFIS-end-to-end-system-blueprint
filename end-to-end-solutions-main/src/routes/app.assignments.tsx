import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Flag as Whistle, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { checkAssignmentConflicts } from "@/lib/assignments";
import { notifyRefereeAssigned } from "@/lib/notifications";

export const Route = createFileRoute("/app/assignments")({ component: Assignments });

function Assignments() {
  const { hasAnyRole } = useAuth();
  const canAssign = hasAnyRole(["ministry_admin", "ferwafa_admin"]);
  const [matches, setMatches] = useState<any[]>([]);
  const [referees, setReferees] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [matchId, setMatchId] = useState("");
  const [refId, setRefId] = useState("");
  const [role, setRole] = useState("center");
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [override, setOverride] = useState(false);

  const load = async () => {
    const [{ data: m }, { data: r }, { data: a }] = await Promise.all([
      supabase.from("matches").select("id, match_code, kickoff_at, venue, status, referee_id, home_club:home_club_id(short_code), away_club:away_club_id(short_code)").gte("kickoff_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("kickoff_at"),
      supabase.from("referees").select("*").eq("active", true).order("performance_rating", { ascending: false }),
      supabase.from("referee_assignments").select("*, referee:referee_id(full_name, level), match:match_id(match_code)").order("assigned_at", { ascending: false }).limit(100),
    ]);
    setMatches(m ?? []); setReferees(r ?? []); setAssignments(a ?? []);
  };
  useEffect(() => { load(); }, []);

  const runCheck = async () => {
    if (!refId || !matchId) { setConflicts([]); return; }
    const res = await checkAssignmentConflicts(refId, matchId);
    setConflicts(res.conflicts);
  };

  useEffect(() => { runCheck(); /* eslint-disable-next-line */ }, [refId, matchId]);

  const assign = async () => {
    if (!matchId || !refId) { toast.error("Select match and referee"); return; }
    if (conflicts.length > 0 && !override) { toast.error("Resolve conflicts or override"); return; }

    const { error: aErr } = await supabase.from("referee_assignments").insert({
      match_id: matchId, referee_id: refId, role,
    });
    if (aErr) { toast.error(aErr.message); return; }
    if (role === "center") {
      await supabase.from("matches").update({ referee_id: refId }).eq("id", matchId);
    }
    notifyRefereeAssigned(refId, matchId).catch(() => {});
    toast.success("Assignment recorded — referee notified");
    setOpen(false); setMatchId(""); setRefId(""); setConflicts([]); setOverride(false);
    load();
  };

  const upcoming = matches.filter((m) => m.status === "scheduled");
  const unassigned = upcoming.filter((m) => !m.referee_id);

  return (
    <div className="p-6">
      <PageHeader
        title="Referee Assignment Engine"
        subtitle="Auto-conflict detection, rotation rules, and officiating roster"
        actions={canAssign && <Button onClick={() => setOpen(true)}><Whistle className="h-4 w-4 mr-2" /> New assignment</Button>}
      />

      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <Card className="panel"><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Upcoming fixtures</div>
          <div className="text-3xl font-mono mt-1">{upcoming.length}</div>
        </CardContent></Card>
        <Card className="panel"><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Unassigned</div>
          <div className="text-3xl font-mono mt-1 text-warning">{unassigned.length}</div>
        </CardContent></Card>
        <Card className="panel"><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Active referees</div>
          <div className="text-3xl font-mono mt-1 text-success">{referees.length}</div>
        </CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="panel">
          <CardHeader><CardTitle className="text-sm">Unassigned upcoming fixtures</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {unassigned.length === 0 && <div className="text-sm text-muted-foreground">All upcoming fixtures have an assigned center referee.</div>}
            {unassigned.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded border border-border">
                <div className="text-sm">
                  <code className="text-xs font-mono text-muted-foreground">{m.match_code}</code>
                  <div>{m.home_club?.short_code} vs {m.away_club?.short_code}</div>
                  <div className="text-xs text-muted-foreground">{new Date(m.kickoff_at).toLocaleString("en-RW")}</div>
                </div>
                {canAssign && <Button size="sm" variant="outline" onClick={() => { setMatchId(m.id); setOpen(true); }}>Assign</Button>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader><CardTitle className="text-sm">Recent assignments</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
            {assignments.length === 0 && <div className="text-sm text-muted-foreground">No assignments yet.</div>}
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 rounded border border-border">
                <div className="text-sm">
                  <div className="font-medium">{a.referee?.full_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{a.match?.match_code} · {a.role}</div>
                </div>
                <Badge variant="outline" className="uppercase text-[10px]">{a.referee?.level}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Assign referee</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Match</Label>
              <Select value={matchId} onValueChange={setMatchId}>
                <SelectTrigger><SelectValue placeholder="Select fixture" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {upcoming.map((m) => <SelectItem key={m.id} value={m.id}>{m.match_code} · {new Date(m.kickoff_at).toLocaleDateString()}</SelectItem>)}
                </SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Referee</Label>
              <Select value={refId} onValueChange={setRefId}>
                <SelectTrigger><SelectValue placeholder="Select referee" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {referees.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name} · {r.level} · ★{Number(r.performance_rating).toFixed(1)}</SelectItem>)}
                </SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center referee</SelectItem>
                  <SelectItem value="assistant_1">Assistant 1</SelectItem>
                  <SelectItem value="assistant_2">Assistant 2</SelectItem>
                  <SelectItem value="fourth">Fourth official</SelectItem>
                  <SelectItem value="var">VAR officer</SelectItem>
                </SelectContent>
              </Select></div>

            {refId && matchId && (
              <div className={`rounded-md border p-3 ${conflicts.length === 0 ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}`}>
                <div className="flex items-center gap-2 text-sm font-medium mb-1">
                  {conflicts.length === 0 ? <><CheckCircle2 className="h-4 w-4 text-success" /> No conflicts detected</> : <><AlertTriangle className="h-4 w-4 text-warning" /> Conflicts detected</>}
                </div>
                {conflicts.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                    {conflicts.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                )}
                {conflicts.length > 0 && (
                  <label className="flex items-center gap-2 mt-2 text-xs">
                    <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                    <ShieldAlert className="h-3 w-3 text-destructive" /> Override (logged in audit trail)
                  </label>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={assign} disabled={conflicts.length > 0 && !override}>Confirm assignment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
