import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2 } from "lucide-react";
import { generateReport, type ReportKind } from "@/lib/reports";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/reports")({ component: Reports });

const REPORTS: { kind: ReportKind; title: string; desc: string }[] = [
  { kind: "weekly_digest", title: "Weekly Governance Digest", desc: "7-day rollup: matches, goals, sanctions, fines, transfers, VAR, and audit volume." },
  { kind: "weekly_matches", title: "Weekly Match Summary", desc: "All fixtures, scores, and event timelines for the matchday." },
  { kind: "discipline", title: "Discipline Bulletin", desc: "Active sanctions, suspensions, and pending appeals." },
  { kind: "referee_performance", title: "Referee Performance Report", desc: "Per-referee aggregated ratings and decision audit." },
  { kind: "standings", title: "League Standings", desc: "Current Premier League table snapshot, computed live." },
  { kind: "ministry_compliance", title: "Ministry Compliance Report", desc: "Data sovereignty, audit ledger integrity, SLA metrics." },
];

function Reports() {
  const { profile } = useAuth();
  const [busy, setBusy] = useState<ReportKind | null>(null);

  const run = async (kind: ReportKind) => {
    setBusy(kind);
    try {
      await generateReport(kind, profile?.email ?? "anonymous");
      toast.success("Signed PDF generated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6">
      <PageHeader title="Official Reports Generator" subtitle="Ministry-grade governance reports — Cryptographically signed PDFs" />
      <div className="grid md:grid-cols-2 gap-3">
        {REPORTS.map((r) => (
          <Card key={r.kind} className="panel">
            <CardContent className="p-5 flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <FileText className="h-6 w-6 text-primary shrink-0 mt-1" />
                <div>
                  <div className="font-semibold">{r.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{r.desc}</div>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled={busy === r.kind} onClick={() => run(r.kind)}>
                {busy === r.kind ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-6 font-mono">
        Each PDF embeds a SHA-256 document hash and is recorded in the audit ledger upon generation.
      </p>
    </div>
  );
}
