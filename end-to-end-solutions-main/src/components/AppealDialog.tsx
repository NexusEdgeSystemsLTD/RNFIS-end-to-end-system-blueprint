import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Scale, Upload } from "lucide-react";
import { uploadToBucket, getSignedUrl } from "@/lib/uploads";

export function AppealDialog({
  record, canDecide, onUpdated,
}: { record: any; canDecide: boolean; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [grounds, setGrounds] = useState(record.appeal_grounds ?? "");
  const [decision, setDecision] = useState<string>(record.appeal_status ?? "");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const file = async () => {
    if (!grounds) { toast.error("Provide grounds for appeal"); return; }
    setBusy(true);
    try {
      let evidenceUrl: string | null = record.appeal_evidence_url ?? null;
      if (evidence) {
        const r = await uploadToBucket("appeal-evidence", evidence, record.id);
        evidenceUrl = r.path; // store path; sign on demand
      }
      const { error } = await supabase.from("discipline_records").update({
        appeal_status: "filed", appeal_grounds: grounds, status: "appealed",
        appeal_evidence_url: evidenceUrl,
      }).eq("id", record.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Appeal filed"); setOpen(false); onUpdated();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  const decide = async () => {
    if (!decision) { toast.error("Select a decision"); return; }
    const newStatus = decision === "upheld" ? "active" : decision === "overturned" ? "overturned" : "active";
    const { error } = await supabase.from("discipline_records").update({
      appeal_status: decision, appeal_decided_at: new Date().toISOString(), status: newStatus,
    }).eq("id", record.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Appeal ${decision}`); setOpen(false); onUpdated();
  };

  const openEvidence = async () => {
    if (!record.appeal_evidence_url) return;
    const url = await getSignedUrl("appeal-evidence", record.appeal_evidence_url, 3600);
    if (url) window.open(url, "_blank"); else toast.error("Could not sign URL");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Scale className="h-3 w-3 mr-1" /> Appeal</Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Appeal · {record.case_number}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">{record.reason}</div>
          <div className="space-y-1.5"><Label>Grounds for appeal</Label>
            <Textarea rows={4} value={grounds} onChange={(e) => setGrounds(e.target.value)} placeholder="Procedural error, new evidence, disproportionate sanction…" disabled={!!record.appeal_status && record.appeal_status !== "filed"} />
          </div>
          {!record.appeal_status && (
            <div className="space-y-1.5"><Label className="flex items-center gap-1"><Upload className="h-3 w-3" /> Evidence file (optional)</Label>
              <Input type="file" accept="application/pdf,image/*,video/*" onChange={(e) => setEvidence(e.target.files?.[0] ?? null)} />
              {evidence && <div className="text-[10px] text-muted-foreground font-mono">{evidence.name} · {(evidence.size / 1024).toFixed(1)} KB</div>}
            </div>
          )}
          {record.appeal_evidence_url && (
            <button className="text-xs underline text-muted-foreground" onClick={openEvidence}>View attached evidence</button>
          )}
          {record.appeal_status && (
            <div className="text-xs"><span className="text-muted-foreground">Current status:</span> <span className="font-mono uppercase">{record.appeal_status}</span></div>
          )}
          {canDecide && record.appeal_status === "filed" && (
            <div className="space-y-1.5"><Label>Tribunal decision</Label>
              <Select value={decision} onValueChange={setDecision}>
                <SelectTrigger><SelectValue placeholder="Select decision" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upheld">Upheld (sanction stands)</SelectItem>
                  <SelectItem value="reduced">Reduced</SelectItem>
                  <SelectItem value="overturned">Overturned</SelectItem>
                </SelectContent>
              </Select></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          {!record.appeal_status && <Button onClick={file} disabled={busy}>{busy ? "Filing…" : "File appeal"}</Button>}
          {canDecide && record.appeal_status === "filed" && <Button onClick={decide}>Record decision</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
