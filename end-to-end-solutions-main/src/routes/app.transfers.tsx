import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRightLeft, Plus } from "lucide-react";

export const Route = createFileRoute("/app/transfers")({ component: Transfers });

function Transfers() {
  const { hasAnyRole } = useAuth();
  const canRecord = hasAnyRole(["ministry_admin", "ferwafa_admin"]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    player_id: "", from_club_id: "", to_club_id: "", fee_amount: "0",
    transfer_date: new Date().toISOString().slice(0, 10), notes: "",
  });

  const load = async () => {
    const [{ data: t }, { data: p }, { data: c }] = await Promise.all([
      supabase.from("player_transfers")
        .select("*, player:player_id(full_name), from_club:from_club_id(name, short_code), to_club:to_club_id(name, short_code)")
        .order("transfer_date", { ascending: false }),
      supabase.from("players").select("id, full_name, club_id").order("full_name"),
      supabase.from("clubs").select("id, name, short_code").order("name"),
    ]);
    setTransfers(t ?? []); setPlayers(p ?? []); setClubs(c ?? []);
  };
  useEffect(() => { load(); }, []);

  const record = async () => {
    if (!form.player_id || !form.to_club_id) { toast.error("Player and destination club required"); return; }
    const { error } = await supabase.from("player_transfers").insert({
      player_id: form.player_id,
      from_club_id: form.from_club_id || null,
      to_club_id: form.to_club_id,
      fee_amount: parseFloat(form.fee_amount) || 0,
      transfer_date: form.transfer_date,
      notes: form.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    // Update player's current club
    await supabase.from("players").update({ club_id: form.to_club_id }).eq("id", form.player_id);
    toast.success("Transfer recorded");
    setOpen(false);
    setForm({ player_id: "", from_club_id: "", to_club_id: "", fee_amount: "0", transfer_date: new Date().toISOString().slice(0, 10), notes: "" });
    load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Player Transfers"
        subtitle="Transfer market: registrations, club movements, and fees"
        actions={canRecord && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Record transfer</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Record player transfer</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="col-span-2 space-y-1.5"><Label>Player</Label>
                  <Select value={form.player_id} onValueChange={(v) => {
                    const p = players.find((x) => x.id === v);
                    setForm({ ...form, player_id: v, from_club_id: p?.club_id ?? "" });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
                <div className="space-y-1.5"><Label>From club</Label>
                  <Select value={form.from_club_id} onValueChange={(v) => setForm({ ...form, from_club_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Free agent" /></SelectTrigger>
                    <SelectContent>{clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1.5"><Label>To club</Label>
                  <Select value={form.to_club_id} onValueChange={(v) => setForm({ ...form, to_club_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select club" /></SelectTrigger>
                    <SelectContent>{clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1.5"><Label>Fee (RWF)</Label>
                  <Input type="number" min={0} value={form.fee_amount} onChange={(e) => setForm({ ...form, fee_amount: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Date</Label>
                  <Input type="date" value={form.transfer_date} onChange={(e) => setForm({ ...form, transfer_date: e.target.value })} /></div>
                <div className="col-span-2 space-y-1.5"><Label>Notes</Label>
                  <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Loan, contract length, conditions…" /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={record}>Record transfer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />

      <div className="space-y-2">
        {transfers.length === 0 && <div className="text-sm text-muted-foreground p-12 text-center">No transfers recorded yet.</div>}
        {transfers.map((t) => (
          <Card key={t.id} className="panel"><CardContent className="p-4 flex items-center gap-4 flex-wrap">
            <div className="text-xs font-mono text-muted-foreground w-24 shrink-0">{new Date(t.transfer_date).toLocaleDateString()}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{t.player?.full_name ?? "—"}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>{t.from_club?.short_code ?? "Free agent"}</span>
                <ArrowRightLeft className="h-3 w-3" />
                <span className="font-medium text-foreground">{t.to_club?.short_code ?? "—"}</span>
              </div>
              {t.notes && <div className="text-[10px] text-muted-foreground font-mono mt-1">{t.notes}</div>}
            </div>
            {Number(t.fee_amount) > 0 && (
              <div className="text-sm font-mono font-bold text-primary">RWF {Number(t.fee_amount).toLocaleString()}</div>
            )}
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
