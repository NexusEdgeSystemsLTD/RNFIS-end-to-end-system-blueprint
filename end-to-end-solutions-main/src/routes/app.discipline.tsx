import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Gavel, FileDown, ShieldCheck, FileSpreadsheet } from "lucide-react";
import { SuspensionCalculator } from "@/components/SuspensionCalculator";
import { AppealDialog } from "@/components/AppealDialog";
import { generateDisciplineDecision, verifyDecisionPdf, exportExcel } from "@/lib/reports";

export const Route = createFileRoute("/app/discipline")({ component: Discipline });

type DType = "warning" | "fine" | "suspension" | "ban" | "probation";
type DStatus = "pending" | "active" | "served" | "appealed" | "overturned";

function Discipline() {
  const { hasAnyRole, profile } = useAuth();
  const canIssue = hasAnyRole(["ministry_admin", "ferwafa_admin"]);
  const [records, setRecords] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | DStatus>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    discipline_type: "warning" as DType,
    player_id: "",
    club_id: "",
    match_id: "",
    reason: "",
    fine_amount: "0",
    suspension_matches: "0",
    effective_until: "",
  });

  const load = async () => {
    const [{ data: rec }, { data: pl }, { data: cl }, { data: mt }] = await Promise.all([
      supabase.from("discipline_records").select("*, player:player_id(full_name), club:club_id(name, short_code), match:match_id(match_code)").order("issued_at", { ascending: false }),
      supabase.from("players").select("id, full_name, club_id").order("full_name"),
      supabase.from("clubs").select("id, name, short_code").order("name"),
      supabase.from("matches").select("id, match_code, kickoff_at").order("kickoff_at", { ascending: false }).limit(100),
    ]);
    setRecords(rec ?? []); setPlayers(pl ?? []); setClubs(cl ?? []); setMatches(mt ?? []);
  };
  useEffect(() => { load(); }, []);

  const issue = async () => {
    if (!form.reason) { toast.error("Reason is required"); return; }
    if (!form.player_id && !form.club_id) { toast.error("Select player or club"); return; }
    const caseNumber = `DISC-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const status: DStatus = form.discipline_type === "warning" ? "active" : "pending";
    const { error } = await supabase.from("discipline_records").insert({
      case_number: caseNumber,
      discipline_type: form.discipline_type,
      player_id: form.player_id || null,
      club_id: form.club_id || null,
      match_id: form.match_id || null,
      reason: form.reason,
      fine_amount: parseFloat(form.fine_amount) || 0,
      suspension_matches: parseInt(form.suspension_matches) || 0,
      effective_until: form.effective_until || null,
      status,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Sanction ${caseNumber} issued`);
    setOpen(false);
    setForm({ discipline_type: "warning", player_id: "", club_id: "", match_id: "", reason: "", fine_amount: "0", suspension_matches: "0", effective_until: "" });
    load();
  };

  const updateStatus = async (id: string, status: DStatus) => {
    const { error } = await supabase.from("discipline_records").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${status}`);
    load();
  };

  const visible = records.filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="p-6">
      <PageHeader
        title="Discipline Engine"
        subtitle="Sanctions, suspensions, fines, and appeals"
        actions={<>
          <SuspensionCalculator />
          {canIssue && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Gavel className="h-4 w-4 mr-2" /> Issue sanction</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Issue disciplinary action</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="space-y-1.5"><Label>Type</Label>
                  <Select value={form.discipline_type} onValueChange={(v) => setForm({ ...form, discipline_type: v as DType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="fine">Fine</SelectItem>
                      <SelectItem value="suspension">Suspension</SelectItem>
                      <SelectItem value="ban">Ban</SelectItem>
                      <SelectItem value="probation">Probation</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div className="space-y-1.5"><Label>Effective until</Label>
                  <Input type="date" value={form.effective_until} onChange={(e) => setForm({ ...form, effective_until: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Player (optional)</Label>
                  <Select value={form.player_id} onValueChange={(v) => setForm({ ...form, player_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
                <div className="space-y-1.5"><Label>Club (optional)</Label>
                  <Select value={form.club_id} onValueChange={(v) => setForm({ ...form, club_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select club" /></SelectTrigger>
                    <SelectContent>
                      {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
                <div className="space-y-1.5"><Label>Fine (RWF)</Label>
                  <Input type="number" min={0} value={form.fine_amount} onChange={(e) => setForm({ ...form, fine_amount: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Suspension matches</Label>
                  <Input type="number" min={0} value={form.suspension_matches} onChange={(e) => setForm({ ...form, suspension_matches: e.target.value })} /></div>
                <div className="col-span-2 space-y-1.5"><Label>Related match (optional)</Label>
                  <Select value={form.match_id} onValueChange={(v) => setForm({ ...form, match_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select match" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {matches.map((m) => <SelectItem key={m.id} value={m.id}>{m.match_code} · {new Date(m.kickoff_at).toLocaleDateString()}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
                <div className="col-span-2 space-y-1.5"><Label>Reason</Label>
                  <Textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Description of the offense and basis for sanction" /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={issue}>Issue sanction</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
        </>}
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {(["all", "pending", "active", "served", "appealed", "overturned"] as const).map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)} className="capitalize">{s}</Button>
        ))}
      </div>

      <div className="space-y-2">
        {visible.length === 0 && <div className="text-sm text-muted-foreground p-12 text-center">No discipline records.</div>}
        {visible.map((r) => (
          <Card key={r.id} className="panel"><CardContent className="p-4 flex items-center gap-4 flex-wrap">
            <code className="text-xs font-mono text-muted-foreground w-40 shrink-0">{r.case_number}</code>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{r.player?.full_name ?? r.club?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{r.reason}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                {r.match?.match_code && `Match: ${r.match.match_code} · `}
                {r.fine_amount > 0 && `Fine: RWF ${Number(r.fine_amount).toLocaleString()} · `}
                {r.suspension_matches > 0 && `${r.suspension_matches} match ban`}
              </div>
            </div>
            <Badge variant="outline" className="uppercase text-[10px]">{r.discipline_type}</Badge>
            <Badge variant={r.status === "active" ? "destructive" : r.status === "served" ? "secondary" : "outline"} className="uppercase text-[10px]">{r.status}</Badge>
            {r.appeal_status && <Badge variant="outline" className="uppercase text-[10px]">Appeal: {r.appeal_status}</Badge>}
            <Button size="sm" variant="outline" className="h-8" onClick={async () => {
              try { await generateDisciplineDecision(r.id, profile?.email ?? "anonymous"); }
              catch (e: any) { toast.error(e?.message ?? "Failed"); }
            }}>
              <FileDown className="h-3 w-3 mr-1" /> Decision PDF
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => {
              exportExcel(`RNFIS_${r.case_number}.xlsx`, "Decision", [{
                case_number: r.case_number, type: r.discipline_type, status: r.status,
                subject: r.player?.full_name ?? r.club?.name ?? "—",
                fine_RWF: r.fine_amount, suspension_matches: r.suspension_matches,
                issued_at: r.issued_at, effective_until: r.effective_until,
                reason: r.reason, appeal_status: r.appeal_status,
                decision_pdf_hash: r.decision_pdf_hash, anchor_seq: r.decision_pdf_anchor_seq,
              }]);
            }}>
              <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={async () => {
              const v = await verifyDecisionPdf(r.id);
              if (v.ok) toast.success(`✓ ${v.reason}`);
              else toast.error(`✗ ${v.reason}`);
            }}>
              <ShieldCheck className="h-3 w-3 mr-1" /> Verify
            </Button>
            {r.status !== "served" && r.status !== "overturned" && <AppealDialog record={r} canDecide={canIssue} onUpdated={load} />}
            {canIssue && r.status !== "served" && r.status !== "overturned" && (
              <Select onValueChange={(v) => updateStatus(r.id, v as DStatus)}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Update" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activate</SelectItem>
                  <SelectItem value="served">Mark served</SelectItem>
                  <SelectItem value="appealed">Appealed</SelectItem>
                  <SelectItem value="overturned">Overturn</SelectItem>
                </SelectContent>
              </Select>
            )}
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
