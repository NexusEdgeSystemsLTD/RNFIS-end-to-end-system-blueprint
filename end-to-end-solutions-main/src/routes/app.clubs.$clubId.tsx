import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/clubs/$clubId")({ component: ClubDetail });

function ClubDetail() {
  const { clubId } = Route.useParams();
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["ministry_admin", "ferwafa_admin"]);

  const [club, setClub] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [allClubs, setAllClubs] = useState<any[]>([]);

  const load = useCallback(async () => {
    const [{ data: c }, { data: r }, { data: t }, { data: a }] = await Promise.all([
      supabase.from("clubs").select("*").eq("id", clubId).single(),
      supabase.from("players").select("*").eq("club_id", clubId).order("jersey_number"),
      supabase
        .from("player_transfers")
        .select("*, player:player_id(full_name), from_club:from_club_id(name, short_code), to_club:to_club_id(name, short_code)")
        .or(`from_club_id.eq.${clubId},to_club_id.eq.${clubId}`)
        .order("transfer_date", { ascending: false })
        .limit(20),
      supabase.from("clubs").select("id, name, short_code").neq("id", clubId).order("name"),
    ]);
    setClub(c); setRoster(r ?? []); setTransfers(t ?? []); setAllClubs(a ?? []);
  }, [clubId]);

  useEffect(() => { load(); }, [load]);

  if (!club) return <div className="p-6 text-muted-foreground">Loading club…</div>;

  return (
    <div className="p-6 space-y-6">
      <Link to="/app/clubs"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> All clubs</Button></Link>
      <PageHeader title={club.name} subtitle={`${club.city ?? ""} · ${club.home_stadium ?? ""} · est ${club.founded_year ?? "—"}`} />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="panel lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Roster ({roster.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {roster.length === 0 && <div className="text-sm text-muted-foreground">No players registered.</div>}
              {roster.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-accent">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm w-8 text-center text-muted-foreground">#{p.jersey_number ?? "—"}</span>
                    <div>
                      <div className="text-sm font-medium">{p.full_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p.position} · {p.license_number ?? "no license"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{p.appearances} apps · {p.goals} G</Badge>
                    {canEdit && <TransferDialog player={p} clubs={allClubs} fromClubId={clubId} onDone={load} />}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader><CardTitle className="text-sm">Recent transfers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {transfers.length === 0 && <div className="text-sm text-muted-foreground">No transfers logged.</div>}
            {transfers.map((t) => (
              <div key={t.id} className="text-xs border-l-2 border-primary pl-3 py-1">
                <div className="font-medium">{t.player?.full_name}</div>
                <div className="text-muted-foreground">
                  {t.from_club?.short_code ?? "—"} → {t.to_club?.short_code ?? "—"} · {new Date(t.transfer_date).toLocaleDateString("en-RW")}
                </div>
                {t.fee_amount > 0 && <div className="text-muted-foreground font-mono">RWF {Number(t.fee_amount).toLocaleString()}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TransferDialog({ player, clubs, fromClubId, onDone }: { player: any; clubs: any[]; fromClubId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [toClub, setToClub] = useState("");
  const [fee, setFee] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!toClub) return toast.error("Select destination club");
    setBusy(true);
    const { error: e1 } = await supabase.from("player_transfers").insert({
      player_id: player.id,
      from_club_id: fromClubId,
      to_club_id: toClub,
      fee_amount: fee ? parseFloat(fee) : 0,
      notes: notes || null,
    });
    if (e1) { setBusy(false); return toast.error(e1.message); }
    const { error: e2 } = await supabase.from("players").update({ club_id: toClub }).eq("id", player.id);
    setBusy(false);
    if (e2) return toast.error(e2.message);
    toast.success(`${player.full_name} transferred`);
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm"><ArrowRightLeft className="h-3 w-3" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Transfer {player.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Destination club</Label>
            <Select value={toClub} onValueChange={setToClub}>
              <SelectTrigger><SelectValue placeholder="Select club" /></SelectTrigger>
              <SelectContent>
                {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fee (RWF)</Label>
            <Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} min={0} />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full">Confirm transfer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
