import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Weekly governance digest cron endpoint.
 * Triggered every Monday morning by pg_cron.
 *
 * The endpoint computes the digest metrics server-side and enqueues an email
 * notification (channel = "email") for each ministry administrator. The
 * actual email delivery is handled by the configured email pipeline; we just
 * persist the dispatch intent into the `notifications` table so it is
 * tamper-evident and replayable.
 *
 * The PDF/Excel artifacts are generated on-demand from the Reports module —
 * what's shipped via email is the executive summary plus a link back to the
 * dashboard where signed PDF/Excel/CSV exports can be downloaded.
 */
export const Route = createFileRoute("/api/public/weekly-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.replace("Bearer ", "") ?? "";
        if (!token) return new Response("unauthorized", { status: 401 });

        // Use service role key to bypass RLS for cross-tenant aggregation
        const supabase = createClient(
          process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL ?? "",
          process.env.SUPABASE_SERVICE_ROLE_KEY ?? token,
          { auth: { autoRefreshToken: false, persistSession: false } },
        );

        const since = new Date(Date.now() - 7 * 86400_000).toISOString();
        const [{ data: m }, { data: d }, { data: v }, { data: a }, { data: t }, { data: admins }] = await Promise.all([
          supabase.from("matches").select("status, home_score, away_score").gte("kickoff_at", since),
          supabase.from("discipline_records").select("discipline_type, fine_amount, suspension_matches").gte("issued_at", since),
          supabase.from("var_reviews").select("outcome").gte("created_at", since),
          supabase.from("audit_log").select("action").gte("created_at", since),
          supabase.from("player_transfers").select("fee_amount").gte("transfer_date", new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)),
          supabase.from("user_roles").select("user_id").eq("role", "ministry_admin"),
        ]);

        const matchesPlayed = (m ?? []).filter((x: any) => x.status === "completed").length;
        const goals = (m ?? []).reduce((s: number, x: any) => s + (x.home_score ?? 0) + (x.away_score ?? 0), 0);
        const sanctions = (d ?? []).length;
        const totalFines = (d ?? []).reduce((s: number, x: any) => s + Number(x.fine_amount ?? 0), 0);
        const totalBans = (d ?? []).reduce((s: number, x: any) => s + (x.suspension_matches ?? 0), 0);
        const transferVolume = (t ?? []).reduce((s: number, x: any) => s + Number(x.fee_amount ?? 0), 0);

        const body = [
          `RNFIS Weekly Governance Digest — ${new Date().toISOString().slice(0, 10)}`,
          ``,
          `Matches completed: ${matchesPlayed}`,
          `Goals scored: ${goals}`,
          `Goals per match: ${matchesPlayed ? (goals / matchesPlayed).toFixed(2) : "—"}`,
          `Sanctions issued: ${sanctions} (RWF ${totalFines.toLocaleString()} in fines, ${totalBans} match bans)`,
          `VAR reviews: ${(v ?? []).length}`,
          `Player transfers: ${(t ?? []).length} (RWF ${transferVolume.toLocaleString()})`,
          `Audit actions: ${(a ?? []).length}`,
          ``,
          `Download signed PDF / Excel / CSV exports from the Reports module.`,
        ].join("\n");

        // Enqueue email notification for every ministry admin
        const adminUserIds = (admins ?? []).map((r: any) => r.user_id);
        if (adminUserIds.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("email").in("user_id", adminUserIds);
          for (const p of profiles ?? []) {
            if (!p.email) continue;
            await supabase.from("notifications").insert({
              channel: "email", recipient: p.email,
              subject: `RNFIS Weekly Digest · ${new Date().toLocaleDateString("en-RW")}`,
              body, category: "weekly_digest",
            });
          }
        }

        // Audit
        await supabase.from("audit_log").insert({
          actor_email: "cron@rnfis", entity_type: "weekly_digest", action: "generate",
          details: { matchesPlayed, goals, sanctions, totalFines, totalBans, transferVolume, recipients: adminUserIds.length },
        });

        return new Response(JSON.stringify({ ok: true, recipients: adminUserIds.length }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
