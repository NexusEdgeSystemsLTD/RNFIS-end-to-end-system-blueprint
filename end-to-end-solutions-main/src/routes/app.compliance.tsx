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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileCheck2, Plus, Upload } from "lucide-react";
import { daysUntil } from "@/lib/assignments";
import { notifyComplianceOverdue } from "@/lib/notifications";
import { uploadToBucket, getSignedUrl } from "@/lib/uploads";

export const Route = createFileRoute("/app/compliance")({ component: Compliance });

const REQUIREMENTS = [
  "FERWAFA Annual License",
  "Stadium Safety Certificate",
  "Insurance Coverage",
  "Tax Clearance (RRA)",
  "Medical Officer Contract",
  "Youth Development Plan",
  "Financial Audit Report",
  "Anti-Doping Policy Acknowledgement",
];

function Compliance() {
  const { hasAnyRole, profile } = useAuth();
  const canEdit = hasAnyRole(["ministry_admin", "ferwafa_admin", "club_official"]);
  const [docs, setDocs] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ club_id: profile?.club_id ?? "", requirement: REQUIREMENTS[0], status: "pending", due_date: "", document_url: "" });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const [{ data: d }, { data: c }] = await Promise.all([
      supabase.from("club_documents").select("*, club:club_id(name, short_code)").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("clubs").select("id, name, short_code").order("name"),
    ]);
    setDocs(d ?? []); setClubs(c ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.club_id || !form.requirement) { toast.error("Club and requirement required"); return; }
    setUploading(true);
    let storage_path: string | null = null;
    let document_url = form.document_url || null;
    try {
      if (uploadFile) {
        const r = await uploadToBucket("compliance-docs", uploadFile, form.club_id);
        storage_path = r.path; document_url = r.signedUrl;
      }
      const { error } = await supabase.from("club_documents").insert({
        club_id: form.club_id, requirement: form.requirement, status: form.status,
        due_date: form.due_date || null, document_url, storage_path,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Requirement logged");
      setOpen(false); setUploadFile(null); load();
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
    finally { setUploading(false); }
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("club_documents").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${status}`); load();
  };

  const overdue = docs.filter((d) => d.status !== "approved" && d.due_date && new Date(d.due_date) < new Date());
  const grouped = clubs.map((c) => ({ club: c, items: docs.filter((d) => d.club_id === c.id) }));

  return (
    <div className="p-6">
      <PageHeader title="Club Compliance Tracker" subtitle="Annual licensing, safety, financial, and policy requirements"
        actions={canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Log requirement</Button>}
      />

      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <Card className="panel"><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Total requirements</div>
          <div className="text-3xl font-mono mt-1">{docs.length}</div>
        </CardContent></Card>
        <Card className="panel"><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Approved</div>
          <div className="text-3xl font-mono mt-1 text-success">{docs.filter((d) => d.status === "approved").length}</div>
        </CardContent></Card>
        <Card className="panel"><CardContent className="p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Overdue</div>
          <div className="text-3xl font-mono mt-1 text-destructive">{overdue.length}</div>
        </CardContent></Card>
      </div>

      <div className="space-y-4">
        {grouped.filter((g) => g.items.length > 0).map((g) => (
          <Card key={g.club.id} className="panel">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileCheck2 className="h-4 w-4" /> {g.club.name} <span className="text-xs font-mono text-muted-foreground">({g.club.short_code})</span></CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {g.items.map((d) => {
                const days = daysUntil(d.due_date);
                const overdue = d.status !== "approved" && days !== null && days < 0;
                return (
                  <div key={d.id} className="flex items-center justify-between p-2 rounded border border-border">
                    <div className="min-w-0">
                      <div className="text-sm">{d.requirement}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {d.due_date ? `Due ${d.due_date}${days !== null ? ` · ${overdue ? `${-days}d overdue` : `${days}d left`}` : ""}` : "No due date"}
                        {d.document_url && <> · <a className="underline" href={d.document_url} target="_blank" rel="noreferrer">document</a></>}
                        {d.storage_path && <> · <button className="underline" onClick={async () => {
                          const u = await getSignedUrl("compliance-docs", d.storage_path, 3600);
                          if (u) window.open(u, "_blank"); else toast.error("Could not sign URL");
                        }}>open file</button></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={d.status === "approved" ? "secondary" : overdue ? "destructive" : "outline"} className="uppercase text-[10px]">{d.status}</Badge>
                      {overdue && canEdit && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => notifyComplianceOverdue(d.id).then(() => toast.success("Overdue notice queued"))}>
                          Notify
                        </Button>
                      )}
                      {canEdit && (
                        <Select onValueChange={(v) => setStatus(d.id, v)}>
                          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Update" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
        {docs.length === 0 && <div className="text-sm text-muted-foreground p-12 text-center">No compliance items logged yet.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Log compliance requirement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Club</Label>
              <Select value={form.club_id} onValueChange={(v) => setForm({ ...form, club_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select club" /></SelectTrigger>
                <SelectContent>{clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Requirement</Label>
              <Select value={form.requirement} onValueChange={(v) => setForm({ ...form, requirement: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REQUIREMENTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Due date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Document URL (optional)</Label>
              <Input value={form.document_url} onChange={(e) => setForm({ ...form, document_url: e.target.value })} placeholder="https://…" /></div>
            <div className="space-y-1.5"><Label className="flex items-center gap-1"><Upload className="h-3 w-3" /> Or upload file (PDF / image)</Label>
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
              {uploadFile && <div className="text-[10px] text-muted-foreground font-mono">{uploadFile.name} · {(uploadFile.size / 1024).toFixed(1)} KB</div>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={uploading}>Cancel</Button>
            <Button onClick={save} disabled={uploading}>{uploading ? "Uploading…" : "Log requirement"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
