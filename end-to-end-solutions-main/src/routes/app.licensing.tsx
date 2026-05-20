import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarClock, GraduationCap, RefreshCw } from "lucide-react";
import { daysUntil } from "@/lib/assignments";
import { notifyLicenseExpiring } from "@/lib/notifications";

export const Route = createFileRoute("/app/licensing")({ component: Licensing });

function Licensing() {
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["ministry_admin", "ferwafa_admin"]);
  const [referees, setReferees] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [renewOpen, setRenewOpen] = useState(false);
  const [trainOpen, setTrainOpen] = useState(false);
  const [target, setTarget] = useState<any>(null);
  const [newExpiry, setNewExpiry] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [progress, setProgress] = useState("0");
  const [refId, setRefId] = useState("");

  const load = async () => {
    const [{ data: r }, { data: t }] = await Promise.all([
      supabase.from("referees").select("*").order("license_expiry", { ascending: true, nullsFirst: false }),
      supabase.from("training_modules").select("*, referee:referee_id(full_name)").order("created_at", { ascending: false }),
    ]);
    setReferees(r ?? []); setModules(t ?? []);
  };
  useEffect(() => { load(); }, []);

  const renew = async () => {
    if (!target || !newExpiry) return;
    const { error } = await supabase.from("referees").update({ license_expiry: newExpiry, active: true }).eq("id", target.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`License renewed for ${target.full_name}`);
    setRenewOpen(false); setTarget(null); setNewExpiry(""); load();
  };

  const addModule = async () => {
    if (!refId || !moduleName) { toast.error("Select referee and module"); return; }
    const prog = Math.max(0, Math.min(100, parseInt(progress) || 0));
    const { error } = await supabase.from("training_modules").insert({
      referee_id: refId, module_name: moduleName, progress: prog,
      completed_at: prog === 100 ? new Date().toISOString() : null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Training module added");
    setTrainOpen(false); setRefId(""); setModuleName(""); setProgress("0"); load();
  };

  const updateProgress = async (id: string, value: number) => {
    const v = Math.max(0, Math.min(100, value));
    const { error } = await supabase.from("training_modules").update({
      progress: v, completed_at: v === 100 ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const expiringSoon = referees.filter((r) => {
    const d = daysUntil(r.license_expiry);
    return d !== null && d <= 60;
  });

  // Auto-enqueue email reminders for licenses expiring within 14 days (once per page load).
  useEffect(() => {
    if (!referees.length) return;
    referees.forEach((r) => {
      const d = daysUntil(r.license_expiry);
      if (d !== null && d >= 0 && d <= 14) notifyLicenseExpiring(r.id, d).catch(() => {});
    });
  }, [referees]);

  return (
    <div className="p-6">
      <PageHeader title="Licensing & Training" subtitle="Renewals, expiry alerts, and continuing-education tracking"
        actions={canEdit && <Button onClick={() => setTrainOpen(true)}><GraduationCap className="h-4 w-4 mr-2" /> Add training module</Button>}
      />

      <Card className="panel mb-4">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CalendarClock className="h-4 w-4" /> License expiry watch (next 60 days)</CardTitle></CardHeader>
        <CardContent>
          {expiringSoon.length === 0 && <div className="text-sm text-muted-foreground">All active licenses are valid for 60+ days.</div>}
          <div className="space-y-2">
            {expiringSoon.map((r) => {
              const d = daysUntil(r.license_expiry);
              const critical = d !== null && d <= 14;
              return (
                <div key={r.id} className="flex items-center justify-between p-2 rounded border border-border">
                  <div>
                    <div className="font-medium text-sm">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.license_number} · expires {r.license_expiry}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={critical ? "destructive" : "outline"} className="uppercase text-[10px]">{d !== null && d < 0 ? `Expired ${-d}d ago` : `${d}d left`}</Badge>
                    {canEdit && <Button size="sm" variant="outline" onClick={() => { setTarget(r); setNewExpiry(""); setRenewOpen(true); }}><RefreshCw className="h-3 w-3 mr-1" /> Renew</Button>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="panel">
        <CardHeader><CardTitle className="text-sm">Training modules</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {modules.length === 0 && <div className="text-sm text-muted-foreground">No training modules recorded.</div>}
          {modules.map((m) => (
            <div key={m.id} className="p-3 rounded border border-border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-medium">{m.module_name}</div>
                  <div className="text-xs text-muted-foreground">{m.referee?.full_name}</div>
                </div>
                <Badge variant={m.progress === 100 ? "secondary" : "outline"} className="uppercase text-[10px]">{m.progress === 100 ? "Completed" : "In progress"}</Badge>
              </div>
              <Progress value={m.progress} className="h-2" />
              {canEdit && m.progress < 100 && (
                <div className="flex items-center gap-2 mt-2">
                  <Input type="number" min={0} max={100} defaultValue={m.progress} className="h-8 w-24"
                    onBlur={(e) => updateProgress(m.id, parseInt(e.target.value) || 0)} />
                  <span className="text-xs text-muted-foreground">% complete (blur to save)</span>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Renew license · {target?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label>New expiry date</Label>
            <Input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenewOpen(false)}>Cancel</Button>
            <Button onClick={renew} disabled={!newExpiry}>Confirm renewal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trainOpen} onOpenChange={setTrainOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add training module</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Referee</Label>
              <Select value={refId} onValueChange={setRefId}>
                <SelectTrigger><SelectValue placeholder="Select referee" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {referees.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}
                </SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Module name</Label>
              <Input value={moduleName} onChange={(e) => setModuleName(e.target.value)} placeholder="VAR Protocol Refresher 2026" /></div>
            <div className="space-y-1.5"><Label>Initial progress (%)</Label>
              <Input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTrainOpen(false)}>Cancel</Button>
            <Button onClick={addModule}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
