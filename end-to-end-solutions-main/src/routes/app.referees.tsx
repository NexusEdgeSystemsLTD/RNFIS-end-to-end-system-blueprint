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
import { UserPlus, Pencil } from "lucide-react";

export const Route = createFileRoute("/app/referees")({ component: Referees });

type RefLevel = "national" | "elite" | "caf" | "fifa";

interface RefForm {
  full_name: string;
  license_number: string;
  level: RefLevel;
  specialization: string;
  performance_rating: string;
}

const EMPTY: RefForm = { full_name: "", license_number: "", level: "national", specialization: "", performance_rating: "7.5" };

function Referees() {
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["ministry_admin", "ferwafa_admin"]);
  const [refs, setRefs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<RefForm>(EMPTY);

  const load = async () => {
    const { data } = await supabase.from("referees").select("*").order("performance_rating", { ascending: false });
    setRefs(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      full_name: r.full_name, license_number: r.license_number, level: r.level,
      specialization: r.specialization ?? "", performance_rating: String(r.performance_rating ?? 7.5),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.full_name || !form.license_number) { toast.error("Name and license required"); return; }
    const payload = {
      full_name: form.full_name, license_number: form.license_number, level: form.level,
      specialization: form.specialization || null,
      performance_rating: parseFloat(form.performance_rating) || 7.5,
    };
    const { error } = editing
      ? await supabase.from("referees").update(payload).eq("id", editing.id)
      : await supabase.from("referees").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Referee updated" : "Referee registered");
    setOpen(false); load();
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Referee Management"
        subtitle="Licensed officials, performance ratings, and assignment readiness"
        actions={canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><UserPlus className="h-4 w-4 mr-2" /> Register referee</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{editing ? "Edit referee" : "Register referee"}</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5"><Label>Full name</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>License number</Label>
                  <Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} placeholder="REF-RWA-XXXX" /></div>
                <div className="space-y-1.5"><Label>Level</Label>
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v as RefLevel })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="national">National</SelectItem>
                      <SelectItem value="elite">Elite</SelectItem>
                      <SelectItem value="caf">CAF</SelectItem>
                      <SelectItem value="fifa">FIFA</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div className="space-y-1.5"><Label>Specialization</Label>
                  <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="Center referee, VAR, …" /></div>
                <div className="space-y-1.5"><Label>Performance rating (0–10)</Label>
                  <Input type="number" step="0.1" min={0} max={10} value={form.performance_rating} onChange={(e) => setForm({ ...form, performance_rating: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save}>{editing ? "Save changes" : "Register"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {refs.map((r) => (
          <Card key={r.id} className="panel">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{r.full_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.license_number}</div>
                </div>
                <Badge variant="outline" className="uppercase text-[10px]">{r.level}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mb-3 min-h-[1rem]">{r.specialization ?? "—"}</div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                <div><div className="font-mono text-lg">{r.matches_officiated}</div><div className="text-[10px] text-muted-foreground uppercase">Matches</div></div>
                <div><div className="font-mono text-lg text-primary">{Number(r.performance_rating).toFixed(2)}</div><div className="text-[10px] text-muted-foreground uppercase">Rating</div></div>
              </div>
              {canEdit && (
                <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => openEdit(r)}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {refs.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">No referees registered yet.</div>}
      </div>
    </div>
  );
}
