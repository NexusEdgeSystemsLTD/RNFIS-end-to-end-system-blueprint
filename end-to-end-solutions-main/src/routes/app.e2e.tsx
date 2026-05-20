import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Play, Download, CheckCircle2, XCircle, Loader2, Circle, FileDown } from "lucide-react";
import { runE2EWalkthrough, reportToMarkdown, type RunReport, type StepResult } from "@/lib/e2e-runner";

export const Route = createFileRoute("/app/e2e")({ component: E2EPage });

function E2EPage() {
  const { hasAnyRole } = useAuth();
  const canRun = hasAnyRole(["ministry_admin", "ferwafa_admin"]);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<RunReport | null>(null);

  const onRun = async () => {
    setRunning(true);
    setReport(null);
    setSteps([]);
    try {
      const r = await runE2EWalkthrough((s) => {
        setSteps((prev) => {
          const i = prev.findIndex((x) => x.id === s.id);
          if (i === -1) return [...prev, s];
          const copy = [...prev]; copy[i] = s; return copy;
        });
      });
      setReport(r);
      if (r.failed === 0) toast.success(`E2E PASS · ${r.passed}/${r.total} steps`);
      else toast.error(`E2E FAIL · ${r.failed} of ${r.total} failed`);
    } catch (e: any) {
      toast.error(e?.message ?? "Test runner crashed");
    } finally {
      setRunning(false);
    }
  };

  const downloadMarkdown = () => {
    if (!report) return;
    const md = reportToMarkdown(report);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `RNFIS_E2E_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  const downloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `RNFIS_E2E_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const total = steps.length || 12;
  const done = steps.filter((s) => s.status === "passed" || s.status === "failed").length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="p-6">
      <PageHeader
        title="End-to-End Test Runner"
        subtitle="Executes the full governance walkthrough: assignment, conflict override, license renewal, appeal, compliance, and audit verification"
        actions={
          <div className="flex gap-2">
            <Button onClick={onRun} disabled={!canRun || running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              {running ? "Running…" : "Run walkthrough"}
            </Button>
            {report && (
              <>
                <Button variant="outline" onClick={downloadMarkdown}><FileDown className="h-4 w-4 mr-2" /> Markdown</Button>
                <Button variant="outline" onClick={downloadJson}><Download className="h-4 w-4 mr-2" /> JSON</Button>
              </>
            )}
          </div>
        }
      />

      {!canRun && (
        <Card className="panel mb-4">
          <CardContent className="p-4 text-sm text-muted-foreground">
            You need ministry_admin or ferwafa_admin role to run the E2E walkthrough.
          </CardContent>
        </Card>
      )}

      {(running || steps.length > 0) && (
        <Card className="panel mb-4">
          <CardHeader><CardTitle className="text-sm">Progress</CardTitle></CardHeader>
          <CardContent>
            <Progress value={pct} className="h-2 mb-3" />
            <div className="text-xs text-muted-foreground font-mono">{done}/{total} steps · {pct}%</div>
          </CardContent>
        </Card>
      )}

      {report && (
        <Card className={`panel mb-4 ${report.failed === 0 ? "border-success" : "border-destructive"}`}>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              {report.failed === 0
                ? <><CheckCircle2 className="h-4 w-4 text-success" /> All checks passed</>
                : <><XCircle className="h-4 w-4 text-destructive" /> {report.failed} step(s) failed</>}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs font-mono grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><div className="text-muted-foreground">Passed</div><div className="text-success text-lg">{report.passed}</div></div>
            <div><div className="text-muted-foreground">Failed</div><div className="text-destructive text-lg">{report.failed}</div></div>
            <div><div className="text-muted-foreground">Total</div><div className="text-lg">{report.total}</div></div>
            <div><div className="text-muted-foreground">Duration</div><div className="text-lg">{(report.durationMs / 1000).toFixed(2)}s</div></div>
          </CardContent>
        </Card>
      )}

      <Card className="panel">
        <CardHeader><CardTitle className="text-sm">Steps</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {steps.length === 0 && (
            <div className="text-sm text-muted-foreground">Click "Run walkthrough" to execute the full governance E2E test.</div>
          )}
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-start gap-3 p-3 rounded border border-border">
              <div className="pt-0.5">
                {s.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {s.status === "passed" && <CheckCircle2 className="h-4 w-4 text-success" />}
                {s.status === "failed" && <XCircle className="h-4 w-4 text-destructive" />}
                {s.status === "pending" && <Circle className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{i + 1}. {s.title}</div>
                  <div className="flex items-center gap-2">
                    {s.durationMs !== undefined && <span className="text-[10px] text-muted-foreground font-mono">{s.durationMs}ms</span>}
                    <Badge
                      variant={s.status === "passed" ? "secondary" : s.status === "failed" ? "destructive" : "outline"}
                      className="uppercase text-[10px]"
                    >
                      {s.status}
                    </Badge>
                  </div>
                </div>
                {s.detail && <div className="text-xs text-muted-foreground font-mono mt-1 break-all">{s.detail}</div>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
