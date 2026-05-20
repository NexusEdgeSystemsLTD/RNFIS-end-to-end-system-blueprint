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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Pencil, Power } from "lucide-react";

export const Route = createFileRoute("/app/players")({ component: Players });

type Position = "GK" | "DEF" | "MID" | "FWD";

interface PlayerForm {
  full_name: string;
  date_of_birth: string;
  nationality: string;
  jersey_number: string;
  position: Position;
  club_id: string;
  license_number: string;
}

const EMPTY: PlayerForm = {
  full_name: "", date_of_birth: "", nationality: "Rwanda",
  jersey_number: "", position: "MID", club_id: "", license_number: "",
};

function Players() {
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["ministry_admin", "ferwafa_admin"]);
  const [players, setPlayers] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<PlayerForm>(EMPTY);

  const load = async () => {
    const [{ data: pl }, { data: cl }] = await Promise.all([
      supabase.from("players").select("*, club:club_id(name, short_code, primary_color)").order("full_name"),
      supabase.from("clubs").select("id, name, short_code").eq("active", true).order("name"),
    ]);
    setPlayers(pl ?? []);
    setClubs(cl ?? []);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      full_name: p.full_name,
      date_of_birth: p.date_of_birth,
      nationality: p.nationality,
      jersey_number: p.jersey_number?.toString() ?? "",
      position: p.position,
      club_id: p.club_id ?? "",
      license_number: p.license_number ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.full_name || !form.date_of_birth) { toast.error("Name and date of birth are required"); return; }
    const payload = {
      full_name: form.full_name,
      date_of_birth: form.date_of_birth,
      nationality: form.nationality || "Rwanda",
      jersey_number: form.jersey_number ? parseInt(form.jersey_number) : null,
      position: form.position,
      club_id: form.club_id || null,
      license_number: form.license_number || null,
    };
    const { error } = editing
      ? await supabase.from("players").update(payload).eq("id", editing.id)
      : await supabase.from("players").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Player updated" : "Player registered");
    setOpen(false);
    load();
  };

  const toggleLicense = async (p: any) => {
    const { error } = await supabase.from("players").update({ license_active: !p.license_active }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(p.license_active ? "License suspended" : "License reactivated");
    load();
  };

  const filtered = players.filter((p) =>
    !search || p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.license_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.club?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Player Registry"
        subtitle="Licensed players across all registered clubs"
        actions={canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><UserPlus className="h-4 w-4 mr-2" /> Register player</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit player" : "Register player"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="col-span-2 space-y-1.5">
                  <Label>Full name</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Date of birth</Label>
                  <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nationality</Label>
                  <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Jersey #</Label>
                  <Input type="number" min={1} max={99} value={form.jersey_number} onChange={(e) => setForm({ ...form, jersey_number: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v as Position })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GK">Goalkeeper</SelectItem>
                      <SelectItem value="DEF">Defender</SelectItem>
                      <SelectItem value="MID">Midfielder</SelectItem>
                      <SelectItem value="FWD">Forward</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Club</Label>
                  <Select value={form.club_id} onValueChange={(v) => setForm({ ...form, club_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Unattached" /></SelectTrigger>
                    <SelectContent>
                      {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>License number</Label>
                  <Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} placeholder="RWA-2025-XXXX" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save}>{editing ? "Save changes" : "Register"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <Input placeholder="Search by name, license, or club…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-md" />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => (
          <Card key={p.id} className="panel">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    <span className="truncate">{p.full_name}</span>
                    {!p.license_active && <Badge variant="destructive" className="text-[9px]">SUSPENDED</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{p.license_number ?? "—"}</div>
                </div>
                <Badge variant="outline" className="font-mono shrink-0">#{p.jersey_number ?? "—"}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">{p.club?.name ?? "Unattached"}</span>
                <Badge variant="secondary" className="text-[10px]">{p.position}</Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border text-center">
                <div><div className="font-mono text-sm">{p.appearances}</div><div className="text-[10px] text-muted-foreground uppercase">Apps</div></div>
                <div><div className="font-mono text-sm text-success">{p.goals}</div><div className="text-[10px] text-muted-foreground uppercase">Goals</div></div>
                <div><div className="font-mono text-sm text-warning">{p.yellow_cards}</div><div className="text-[10px] text-muted-foreground uppercase">YC</div></div>
                <div><div className="font-mono text-sm text-destructive">{p.red_cards}</div><div className="text-[10px] text-muted-foreground uppercase">RC</div></div>
              </div>
              {canEdit && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => toggleLicense(p)}>
                    <Power className="h-3 w-3 mr-1" /> {p.license_active ? "Suspend" : "Reactivate"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">No players found.</div>}
      </div>
    </div>
  );
}
