import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Download, ShieldCheck, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/audit")({ component: Audit });

const PAGE_SIZE = 50;

function Audit() {
  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [chainStatus, setChainStatus] = useState<{ ok: boolean; broken: any[] } | null>(null);

  const fetchPage = async (p = page) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("audit_log_search" as any, {
        _from: from ? new Date(from).toISOString() : null,
        _to: to ? new Date(to + "T23:59:59").toISOString() : null,
        _entity: entityFilter || null,
        _action: actionFilter || null,
        _search: search || null,
        _limit: PAGE_SIZE,
        _offset: p * PAGE_SIZE,
      });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      setEntries(rows);
      setTotal(rows[0]?.total_count ? Number(rows[0].total_count) : 0);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(0); fetchPage(0); /* eslint-disable-next-line */ }, [from, to, entityFilter, actionFilter]);
  useEffect(() => { fetchPage(page); /* eslint-disable-next-line */ }, [page]);

  const verifyChain = async () => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.rpc("verify_audit_chain" as any);
      if (error) throw error;
      const broken = (data ?? []) as any[];
      setChainStatus({ ok: broken.length === 0, broken });
      if (broken.length === 0) toast.success("Audit chain intact — every entry hashes correctly");
      else toast.error(`Chain broken at ${broken.length} entr${broken.length === 1 ? "y" : "ies"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const exportFilteredCsv = async () => {
    toast.message("Building filtered CSV…");
    try {
      const { data, error } = await supabase.rpc("audit_log_search" as any, {
        _from: from ? new Date(from).toISOString() : null,
        _to: to ? new Date(to + "T23:59:59").toISOString() : null,
        _entity: entityFilter || null,
        _action: actionFilter || null,
        _search: search || null,
        _limit: 10000, _offset: 0,
      });
      if (error) throw error;
      const rows = [["timestamp", "sequence", "actor", "action", "entity_type", "entity_id", "entry_hash", "prev_hash"]];
      (data ?? []).forEach((e: any) => rows.push([
        new Date(e.created_at).toISOString(), String(e.sequence_number),
        e.actor_email ?? "", e.action, e.entity_type, e.entity_id ?? "",
        e.entry_hash ?? "", e.prev_hash ?? "",
      ]));
      const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${from || "all"}_to_${to || "now"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${(data ?? []).length} entries`);
    } catch (e: any) { toast.error(e?.message ?? "Export failed"); }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const entityTypes = useMemo(() => Array.from(new Set(entries.map((e) => e.entity_type))).sort(), [entries]);
  const actions = useMemo(() => Array.from(new Set(entries.map((e) => e.action))).sort(), [entries]);

  return (
    <div className="p-6">
      <PageHeader
        title="Audit Trail"
        subtitle="Immutable hash-chained ledger — SHA-256 linked, server-paginated, Ministry admin only"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={verifyChain} disabled={verifying}>
              {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Verify chain
            </Button>
            <Button variant="outline" size="sm" onClick={exportFilteredCsv}><Download className="h-4 w-4 mr-2" /> Export filtered CSV</Button>
          </div>
        }
      />
      {chainStatus && (
        <div className={`mb-3 text-xs font-mono p-2 rounded border ${chainStatus.ok ? "border-green-500/40 bg-green-500/5 text-green-400" : "border-destructive bg-destructive/10 text-destructive"}`}>
          {chainStatus.ok
            ? "✓ Audit ledger integrity verified — every entry's SHA-256 matches its declared previous hash."
            : `✗ Chain broken at: ${chainStatus.broken.map((b: any) => `seq ${b.broken_at_seq} (${b.reason})`).join(", ")}`}
        </div>
      )}

      <Card className="panel mb-3"><CardContent className="p-3 grid md:grid-cols-6 gap-3 items-end">
        <div className="space-y-1.5"><Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Entity</Label>
          <Select value={entityFilter || "__all"} onValueChange={(v) => setEntityFilter(v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All entities</SelectItem>
              {entityTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select></div>
        <div className="space-y-1.5"><Label className="text-xs">Action</Label>
          <Select value={actionFilter || "__all"} onValueChange={(v) => setActionFilter(v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All actions</SelectItem>
              {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select></div>
        <div className="space-y-1.5 md:col-span-2"><Label className="text-xs">Search (actor / details)</Label>
          <div className="flex gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setPage(0), fetchPage(0))} placeholder="email, payload text…" />
            <Button variant="outline" onClick={() => { setPage(0); fetchPage(0); }}>Search</Button>
          </div>
        </div>
      </CardContent></Card>

      <Card className="panel"><CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No audit entries match the current filters.</div>
        ) : (
          <div className="divide-y divide-border">{entries.map((e) => (
            <div key={e.id} className="p-3 flex items-center gap-3 text-sm font-mono">
              <span className="text-[10px] text-muted-foreground w-12 shrink-0">#{e.sequence_number}</span>
              <span className="text-xs text-muted-foreground w-44 shrink-0">{new Date(e.created_at).toLocaleString("en-RW")}</span>
              <Badge variant={e.action === "delete" ? "destructive" : e.action === "create" ? "default" : "outline"} className="text-[10px] uppercase">{e.action}</Badge>
              <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">{e.entity_type}</span>
              <span className="flex-1 truncate text-xs">{e.actor_email ?? e.actor_id ?? "system"}</span>
              <Button size="sm" variant="ghost" onClick={() => setDetail(e)} className="h-7"><Eye className="h-3 w-3" /></Button>
            </div>
          ))}</div>
        )}
      </CardContent></Card>

      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground font-mono">
        <span>Showing page {page + 1} / {totalPages} · {total.toLocaleString()} total entries</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}><ChevronLeft className="h-3 w-3" /></Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || loading}><ChevronRight className="h-3 w-3" /></Button>
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Audit entry · {detail?.entity_type} · {detail?.action}</DialogTitle></DialogHeader>
          <div className="space-y-2 text-xs font-mono">
            <div><span className="text-muted-foreground">When:</span> {detail && new Date(detail.created_at).toLocaleString("en-RW")}</div>
            <div><span className="text-muted-foreground">Actor:</span> {detail?.actor_email ?? detail?.actor_id ?? "system"}</div>
            <div><span className="text-muted-foreground">Entity ID:</span> {detail?.entity_id ?? "—"}</div>
            <div><span className="text-muted-foreground">Sequence #:</span> {detail?.sequence_number ?? "—"}</div>
            <div className="break-all"><span className="text-muted-foreground">Prev hash:</span> {detail?.prev_hash ?? "—"}</div>
            <div className="break-all"><span className="text-muted-foreground">Entry hash:</span> {detail?.entry_hash ?? "—"}</div>
            <div className="text-muted-foreground mt-2">Payload:</div>
            <pre className="bg-muted/40 border border-border rounded p-3 overflow-auto max-h-96 text-[11px]">
              {detail && JSON.stringify(detail.details, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
