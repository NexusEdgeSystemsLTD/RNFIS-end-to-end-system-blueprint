import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ShieldCheck,
  Lock,
  Database,
  Activity,
  UserPlus,
  Mail,
  X as XIcon,
} from "lucide-react";

export const Route = createFileRoute("/app/security")({ component: Security });

const ALL_ROLES: AppRole[] = [
  "ministry_admin",
  "ferwafa_admin",
  "club_official",
  "referee",
  "var_officer",
  "public_viewer",
];

const INVITABLE_ROLES: AppRole[] = [
  "ferwafa_admin",
  "club_official",
  "referee",
  "var_officer",
  "public_viewer",
];

function Security() {
  const { hasRole, session } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, AppRole[]>>({});
  const [pending, setPending] = useState<Record<string, AppRole>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inv, setInv] = useState<{ email: string; full_name: string; role: AppRole }>({
    email: "",
    full_name: "",
    role: "public_viewer",
  });

  const load = async () => {
    const [{ data: profiles }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email").order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setUsers(profiles ?? []);
    const map: Record<string, AppRole[]> = {};
    (rolesData ?? []).forEach((r: any) => {
      (map[r.user_id] ||= []).push(r.role);
    });
    setRoles(map);
  };

  useEffect(() => {
    load();
  }, []);

  const grant = async (userId: string) => {
    const role = pending[userId];
    if (!role) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Granted ${ROLE_LABELS[role]}`);
    setPending((p) => {
      const { [userId]: _, ...rest } = p;
      return rest;
    });
    load();
  };

  const revoke = async (userId: string, role: AppRole) => {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Access revoked");
    load();
  };

  const submitInvite = async () => {
    if (!session?.access_token) {
      toast.error("Session expired");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inv.email)) {
      toast.error("Enter a valid email");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(inv),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invite failed");
      toast.success(`Invite sent to ${inv.email}`);
      setInviteOpen(false);
      setInv({ email: "", full_name: "", role: "public_viewer" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setInviting(false);
    }
  };

  if (!hasRole("ministry_admin")) {
    return (
      <div className="p-6">
        <PageHeader title="Users & Roles" />
        <Card className="panel">
          <CardContent className="p-12 text-center text-muted-foreground">
            Restricted to Ministry administrators.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Users & Roles"
        subtitle="Invite operators · Assign role-based access · Revoke privileges"
        actions={
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" /> Invite user
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Invite operator</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-email">Email address</Label>
                  <Input
                    id="inv-email"
                    type="email"
                    placeholder="operator@ferwafa.rw"
                    value={inv.email}
                    onChange={(e) => setInv({ ...inv, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-name">Full name (optional)</Label>
                  <Input
                    id="inv-name"
                    value={inv.full_name}
                    onChange={(e) => setInv({ ...inv, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Initial role</Label>
                  <Select
                    value={inv.role}
                    onValueChange={(v) => setInv({ ...inv, role: v as AppRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Ministry Admin role can only be granted manually after invite.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submitInvite} disabled={inviting}>
                  <Mail className="h-4 w-4 mr-2" />
                  {inviting ? "Sending…" : "Send invite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: ShieldCheck, label: "RLS Policies", val: "Enforced" },
          { icon: Lock, label: "TLS Version", val: "1.3" },
          { icon: Database, label: "Data Region", val: "KGL-DC1" },
          { icon: Activity, label: "Uptime SLA", val: "99.9%" },
        ].map((s) => (
          <Card key={s.label} className="panel">
            <CardContent className="p-4">
              <s.icon className="h-4 w-4 text-primary mb-2" />
              <div className="font-mono text-lg">{s.val}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                {s.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="panel">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border text-sm font-semibold flex items-center justify-between">
            <span>User Role Assignments</span>
            <span className="text-xs text-muted-foreground font-normal">
              {users.length} operators
            </span>
          </div>
          <div className="divide-y divide-border">
            {users.map((u) => (
              <div key={u.user_id} className="p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm font-medium">{u.full_name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(roles[u.user_id] ?? []).map((r) => (
                    <Badge
                      key={r}
                      variant="outline"
                      className="text-[10px] uppercase cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
                      onClick={() => revoke(u.user_id, r)}
                      title="Click to revoke"
                    >
                      {ROLE_LABELS[r]} <XIcon className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                  {(roles[u.user_id] ?? []).length === 0 && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      No access
                    </Badge>
                  )}
                </div>
                <Select
                  value={pending[u.user_id] ?? ""}
                  onValueChange={(v) =>
                    setPending((p) => ({ ...p, [u.user_id]: v as AppRole }))
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Assign role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.filter(
                      (r) => !(roles[u.user_id] ?? []).includes(r),
                    ).map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => grant(u.user_id)} disabled={!pending[u.user_id]}>
                  Grant
                </Button>
              </div>
            ))}
            {users.length === 0 && (
              <div className="p-12 text-center text-muted-foreground text-sm">
                No users yet. Invite your first operator.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
