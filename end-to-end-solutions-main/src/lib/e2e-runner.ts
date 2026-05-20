import { supabase } from "@/integrations/supabase/client";
import { checkAssignmentConflicts } from "@/lib/assignments";
import { notifyRefereeAssigned, notifyLicenseExpiring, notifyComplianceOverdue } from "@/lib/notifications";

export type StepStatus = "pending" | "running" | "passed" | "failed" | "skipped";

export interface StepResult {
  id: string;
  title: string;
  status: StepStatus;
  detail?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
}

export interface RunReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  steps: StepResult[];
}

export type ProgressCb = (step: StepResult) => void;

const STAMP = () => Date.now().toString(36).slice(-6).toUpperCase();

/**
 * End-to-end walkthrough that exercises Phase 2/3/4 governance flows:
 *  1. Pick referee + match, run conflict-of-interest engine
 *  2. Force a conflict (license expiry) and confirm detection
 *  3. Override + assign referee (writes referee_assignments + match.referee_id)
 *  4. Enqueue referee assignment notification
 *  5. Renew the referee's license
 *  6. Enqueue license-expiring reminder
 *  7. Create a discipline record + file an appeal
 *  8. Log a compliance requirement (overdue) + enqueue reminder
 *  9. Verify audit chain integrity and latest anchor
 */
export async function runE2EWalkthrough(onProgress?: ProgressCb): Promise<RunReport> {
  const start = Date.now();
  const steps: StepResult[] = [];

  const run = async (id: string, title: string, fn: () => Promise<StepResult["data"] | void>) => {
    const s: StepResult = { id, title, status: "running" };
    steps.push(s);
    onProgress?.({ ...s });
    const t0 = Date.now();
    try {
      const data = (await fn()) as StepResult["data"] | undefined;
      s.status = "passed";
      s.data = data ?? undefined;
      s.detail = data ? Object.entries(data).map(([k, v]) => `${k}=${String(v)}`).join(" · ") : "ok";
    } catch (e: any) {
      s.status = "failed";
      s.detail = e?.message ?? String(e);
    } finally {
      s.durationMs = Date.now() - t0;
      onProgress?.({ ...s });
    }
  };

  // Shared state across steps
  const state: Record<string, any> = {};

  await run("setup", "Load referee, match & club fixtures", async () => {
    const [{ data: refs }, { data: matches }, { data: clubs }] = await Promise.all([
      supabase.from("referees").select("*").eq("active", true).limit(5),
      supabase.from("matches").select("*").order("kickoff_at", { ascending: false }).limit(5),
      supabase.from("clubs").select("*").limit(5),
    ]);
    if (!refs?.length) throw new Error("No active referees in DB — seed data first");
    if (!matches?.length) throw new Error("No matches in DB — seed data first");
    if (!clubs?.length) throw new Error("No clubs in DB — seed data first");
    state.referee = refs[0];
    state.match = matches[0];
    state.club = clubs[0];
    return { referee: state.referee.full_name, match: state.match.match_code, club: state.club.short_code };
  });

  await run("conflict-baseline", "Run conflict engine (baseline)", async () => {
    const result = await checkAssignmentConflicts(state.referee.id, state.match.id);
    state.baselineConflicts = result.conflicts;
    return { conflicts: result.conflicts.length, list: result.conflicts.join("; ") || "none" };
  });

  await run("force-conflict", "Force expired-license conflict", async () => {
    state.originalExpiry = state.referee.license_expiry;
    const past = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { error } = await supabase.from("referees").update({ license_expiry: past }).eq("id", state.referee.id);
    if (error) throw new Error(error.message);
    const result = await checkAssignmentConflicts(state.referee.id, state.match.id);
    const detected = result.conflicts.some((c) => c.toLowerCase().includes("expired"));
    if (!detected) throw new Error(`Expected expired-license conflict, got: ${result.conflicts.join(", ")}`);
    return { detected: true, conflicts: result.conflicts.length };
  });

  await run("override-assign", "Override conflict & assign referee", async () => {
    // Restore license first (override = admin proceeded with justification)
    const restored = state.originalExpiry ?? new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    await supabase.from("referees").update({ license_expiry: restored }).eq("id", state.referee.id);

    // Upsert assignment
    await supabase.from("referee_assignments").delete()
      .eq("match_id", state.match.id).eq("referee_id", state.referee.id);
    const { data: assn, error } = await supabase.from("referee_assignments").insert({
      match_id: state.match.id, referee_id: state.referee.id, role: "center",
    }).select().single();
    if (error) throw new Error(error.message);

    const { error: mErr } = await supabase.from("matches").update({ referee_id: state.referee.id }).eq("id", state.match.id);
    if (mErr) throw new Error(mErr.message);

    state.assignmentId = assn.id;
    return { assignmentId: assn.id, role: assn.role };
  });

  await run("notify-assigned", "Enqueue referee-assigned notification", async () => {
    await notifyRefereeAssigned(state.referee.id, state.match.id);
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("category", "referee_assigned")
      .eq("related_entity_id", state.match.id);
    return { queued: count ?? 0 };
  });

  await run("renew-license", "Renew referee license (+12 months)", async () => {
    const newExpiry = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    const { error } = await supabase.from("referees").update({ license_expiry: newExpiry, active: true }).eq("id", state.referee.id);
    if (error) throw new Error(error.message);
    return { expiry: newExpiry };
  });

  await run("notify-license", "Enqueue license-expiring reminder", async () => {
    await notifyLicenseExpiring(state.referee.id, 14);
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("category", "license_expiring")
      .eq("related_entity_id", state.referee.id);
    return { queued: count ?? 0 };
  });

  await run("discipline-create", "Create discipline record", async () => {
    const caseNo = `E2E-${new Date().getFullYear()}-${STAMP()}`;
    const { data, error } = await supabase.from("discipline_records").insert({
      case_number: caseNo,
      discipline_type: "fine",
      reason: "E2E test run — automated synthetic case",
      club_id: state.club.id,
      match_id: state.match.id,
      fine_amount: 10000,
      status: "active",
    }).select().single();
    if (error) throw new Error(error.message);
    state.disciplineId = data.id;
    state.caseNo = caseNo;
    return { caseNumber: caseNo, id: data.id };
  });

  await run("appeal-file", "File appeal on discipline case", async () => {
    const { error } = await supabase.from("discipline_records").update({
      appeal_status: "submitted",
      appeal_grounds: "E2E walkthrough: testing appeal workflow end-to-end.",
      status: "appealed",
    }).eq("id", state.disciplineId);
    if (error) throw new Error(error.message);
    const { data } = await supabase.from("discipline_records").select("appeal_status, status").eq("id", state.disciplineId).single();
    if (data?.appeal_status !== "submitted" || data?.status !== "appealed") {
      throw new Error(`Appeal status not persisted: ${JSON.stringify(data)}`);
    }
    return { appealStatus: data.appeal_status, recordStatus: data.status };
  });

  await run("compliance-log", "Log overdue compliance requirement", async () => {
    const past = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase.from("club_documents").insert({
      club_id: state.club.id,
      requirement: `E2E Compliance Audit ${STAMP()}`,
      status: "pending",
      due_date: past,
    }).select().single();
    if (error) throw new Error(error.message);
    state.complianceId = data.id;
    return { id: data.id, dueDate: past };
  });

  await run("notify-compliance", "Enqueue compliance-overdue reminder", async () => {
    await notifyComplianceOverdue(state.complianceId);
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("category", "compliance_overdue")
      .eq("related_entity_id", state.complianceId);
    return { queued: count ?? 0 };
  });

  await run("audit-verify", "Verify hash-chained audit ledger", async () => {
    const [{ data: drift, error: e1 }, { data: anchor, error: e2 }] = await Promise.all([
      supabase.rpc("verify_audit_chain"),
      supabase.rpc("latest_audit_anchor"),
    ]);
    if (e1) throw new Error(`verify_audit_chain: ${e1.message}`);
    if (e2) throw new Error(`latest_audit_anchor: ${e2.message}`);
    if (drift && drift.length > 0) throw new Error(`Chain drift detected at seq ${drift[0].broken_at_seq}: ${drift[0].reason}`);
    const a = anchor?.[0];
    return {
      drift: drift?.length ?? 0,
      anchorSeq: a?.sequence_number ?? "n/a",
      anchorHash: a?.entry_hash ? `${a.entry_hash.slice(0, 12)}…` : "n/a",
    };
  });

  const finished = Date.now();
  return {
    startedAt: new Date(start).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    durationMs: finished - start,
    passed: steps.filter((s) => s.status === "passed").length,
    failed: steps.filter((s) => s.status === "failed").length,
    skipped: steps.filter((s) => s.status === "skipped").length,
    total: steps.length,
    steps,
  };
}

export function reportToMarkdown(r: RunReport): string {
  const lines: string[] = [];
  lines.push(`# RNFIS E2E Walkthrough Report`);
  lines.push(``);
  lines.push(`- **Started:** ${r.startedAt}`);
  lines.push(`- **Finished:** ${r.finishedAt}`);
  lines.push(`- **Duration:** ${(r.durationMs / 1000).toFixed(2)}s`);
  lines.push(`- **Result:** ${r.failed === 0 ? "✅ PASS" : "❌ FAIL"} (${r.passed}/${r.total} passed, ${r.failed} failed)`);
  lines.push(``);
  lines.push(`| # | Step | Status | Duration | Detail |`);
  lines.push(`|---|------|--------|----------|--------|`);
  r.steps.forEach((s, i) => {
    const icon = s.status === "passed" ? "✅" : s.status === "failed" ? "❌" : "⚪";
    lines.push(`| ${i + 1} | ${s.title} | ${icon} ${s.status} | ${s.durationMs ?? 0}ms | ${(s.detail ?? "").replace(/\|/g, "\\|")} |`);
  });
  return lines.join("\n");
}
