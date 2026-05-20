import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Video } from "lucide-react";

interface Props {
  matchId: string;
  defaultMinute?: number;
  onSubmitted?: () => void;
  trigger?: React.ReactNode;
}

const OUTCOMES = [
  "goal_awarded",
  "goal_disallowed",
  "penalty_awarded",
  "penalty_overturned",
  "red_card_issued",
  "no_action",
  "inconclusive",
] as const;

export function VarReviewDialog({ matchId, defaultMinute, onSubmitted, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [minute, setMinute] = useState(String(defaultMinute ?? ""));
  const [incident, setIncident] = useState("");
  const [onField, setOnField] = useState("");
  const [outcome, setOutcome] = useState<typeof OUTCOMES[number]>("no_action");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const m = parseInt(minute);
    if (isNaN(m) || m < 0) return toast.error("Enter a valid minute");
    if (!incident.trim()) return toast.error("Describe the incident");
    setBusy(true);
    const { error: e1 } = await supabase.from("var_reviews").insert({
      match_id: matchId,
      minute: m,
      incident_type: incident,
      on_field_decision: onField || null,
      outcome,
      duration_seconds: duration ? parseInt(duration) : null,
      notes: notes || null,
    });
    if (e1) { setBusy(false); return toast.error(e1.message); }
    // Tie to match events timeline
    await supabase.from("match_events").insert({
      match_id: matchId,
      minute: m,
      event_type: "var_review",
      notes: `${incident} → ${outcome.replace(/_/g, " ")}${onField ? ` (on-field: ${onField})` : ""}`,
    });
    setBusy(false);
    setOpen(false);
    setMinute(""); setIncident(""); setOnField(""); setNotes(""); setDuration("");
    toast.success("VAR review logged");
    onSubmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Video className="h-3 w-3 mr-1" /> Log VAR review
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Log VAR Review</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Minute</Label>
              <Input type="number" value={minute} onChange={(e) => setMinute(e.target.value)} min={0} max={130} />
            </div>
            <div>
              <Label>Duration (s)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min={0} />
            </div>
          </div>
          <div>
            <Label>Incident type</Label>
            <Input value={incident} onChange={(e) => setIncident(e.target.value)} placeholder="e.g. Possible offside, penalty appeal" />
          </div>
          <div>
            <Label>On-field decision</Label>
            <Input value={onField} onChange={(e) => setOnField(e.target.value)} placeholder="e.g. Goal given" />
          </div>
          <div>
            <Label>Outcome</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as typeof OUTCOMES[number])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full">Submit review</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
