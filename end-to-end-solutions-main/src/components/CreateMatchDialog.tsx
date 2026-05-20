import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function CreateMatchDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [clubs, setClubs] = useState<any[]>([]);
  const [referees, setReferees] = useState<any[]>([]);
  const [matchCode, setMatchCode] = useState("");
  const [matchday, setMatchday] = useState("");
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [venue, setVenue] = useState("");
  const [refId, setRefId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("clubs").select("id, name, home_stadium").order("name").then(({ data }) => setClubs(data ?? []));
    supabase.from("referees").select("id, full_name").eq("active", true).order("full_name").then(({ data }) => setReferees(data ?? []));
  }, [open]);

  const submit = async () => {
    if (!matchCode || !homeId || !awayId || !kickoff || !venue) { toast.error("Fill required fields"); return; }
    if (homeId === awayId) { toast.error("Home and away must differ"); return; }
    setSaving(true);
    const { error } = await supabase.from("matches").insert({
      match_code: matchCode,
      matchday: matchday ? parseInt(matchday) : null,
      home_club_id: homeId,
      away_club_id: awayId,
      kickoff_at: new Date(kickoff).toISOString(),
      venue,
      referee_id: refId || null,
      status: "scheduled",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Fixture created");
    onOpenChange(false);
    onCreated();
    setMatchCode(""); setMatchday(""); setHomeId(""); setAwayId(""); setKickoff(""); setVenue(""); setRefId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Fixture</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Match Code</Label><Input value={matchCode} onChange={(e) => setMatchCode(e.target.value)} placeholder="RPL-2025-027" /></div>
            <div><Label>Matchday</Label><Input type="number" value={matchday} onChange={(e) => setMatchday(e.target.value)} /></div>
          </div>
          <div><Label>Home Club</Label>
            <Select value={homeId} onValueChange={(v) => { setHomeId(v); const c = clubs.find((x) => x.id === v); if (c?.home_stadium && !venue) setVenue(c.home_stadium); }}>
              <SelectTrigger><SelectValue placeholder="Select home club" /></SelectTrigger>
              <SelectContent>{clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Away Club</Label>
            <Select value={awayId} onValueChange={setAwayId}>
              <SelectTrigger><SelectValue placeholder="Select away club" /></SelectTrigger>
              <SelectContent>{clubs.filter((c) => c.id !== homeId).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Kickoff</Label><Input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} /></div>
          <div><Label>Venue</Label><Input value={venue} onChange={(e) => setVenue(e.target.value)} /></div>
          <div><Label>Referee</Label>
            <Select value={refId} onValueChange={setRefId}>
              <SelectTrigger><SelectValue placeholder="Assign referee" /></SelectTrigger>
              <SelectContent>{referees.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>Create Fixture</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
