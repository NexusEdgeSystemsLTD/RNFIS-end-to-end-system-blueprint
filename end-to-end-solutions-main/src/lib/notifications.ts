import { supabase } from "@/integrations/supabase/client";

/**
 * Enqueue a notification (email / sms / in-app).
 * The actual delivery is handled by an out-of-band dispatcher (or, for email,
 * Lovable Cloud's email queue). We only persist the intent — this guarantees
 * a tamper-evident trail even if the SMTP/SMS gateway is offline.
 */
export type NotificationChannel = "email" | "sms" | "in_app";

export interface EnqueueArgs {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
  category: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export async function enqueueNotification(args: EnqueueArgs) {
  const { error } = await supabase.from("notifications").insert({
    channel: args.channel,
    recipient: args.recipient,
    subject: args.subject ?? null,
    body: args.body,
    category: args.category,
    related_entity_type: args.relatedEntityType ?? null,
    related_entity_id: args.relatedEntityId ?? null,
  });
  if (error) {
    console.error("notification enqueue failed", error);
    return false;
  }
  return true;
}

export async function notifyRefereeAssigned(refereeId: string, matchId: string) {
  const [{ data: ref }, { data: match }] = await Promise.all([
    supabase.from("referees").select("full_name, user_id").eq("id", refereeId).single(),
    supabase.from("matches").select("match_code, kickoff_at, venue, home_club:home_club_id(short_code), away_club:away_club_id(short_code)").eq("id", matchId).single(),
  ]);
  if (!ref || !match) return;
  // Find email via profile
  let email: string | null = null;
  if (ref.user_id) {
    const { data: p } = await supabase.from("profiles").select("email, phone").eq("user_id", ref.user_id).maybeSingle();
    email = p?.email ?? null;
  }
  const body = `Hello ${ref.full_name}, you have been assigned to match ${(match as any).match_code} ` +
    `(${(match as any).home_club?.short_code} vs ${(match as any).away_club?.short_code}) at ${(match as any).venue} ` +
    `on ${new Date((match as any).kickoff_at).toLocaleString("en-RW")}.`;
  if (email) {
    await enqueueNotification({
      channel: "email", recipient: email,
      subject: `Match assignment · ${(match as any).match_code}`,
      body, category: "referee_assignment",
      relatedEntityType: "matches", relatedEntityId: matchId,
    });
  }
  await enqueueNotification({
    channel: "in_app", recipient: refereeId,
    subject: "Match assignment", body, category: "referee_assignment",
    relatedEntityType: "matches", relatedEntityId: matchId,
  });
}

export async function notifyLicenseExpiring(refereeId: string, daysLeft: number) {
  const { data: ref } = await supabase.from("referees").select("full_name, license_number, license_expiry, user_id").eq("id", refereeId).single();
  if (!ref) return;
  let email: string | null = null;
  if (ref.user_id) {
    const { data: p } = await supabase.from("profiles").select("email").eq("user_id", ref.user_id).maybeSingle();
    email = p?.email ?? null;
  }
  const body = `Reminder: your referee license ${ref.license_number} expires on ${ref.license_expiry} (${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining). Please renew through FERWAFA.`;
  if (email) {
    await enqueueNotification({
      channel: "email", recipient: email,
      subject: `License expiring in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      body, category: "license_expiry",
      relatedEntityType: "referees", relatedEntityId: refereeId,
    });
  }
}

export async function notifyComplianceOverdue(docId: string) {
  const { data: doc } = await supabase
    .from("club_documents")
    .select("requirement, due_date, club:club_id(name)")
    .eq("id", docId)
    .single();
  if (!doc) return;
  const club = (doc as any).club?.name ?? "club";
  const body = `Compliance item OVERDUE — ${doc.requirement} for ${club} was due ${doc.due_date}. Submit immediately to avoid sanctions.`;
  await enqueueNotification({
    channel: "email", recipient: "compliance@ferwafa.rw",
    subject: `Overdue compliance · ${club}`,
    body, category: "compliance_overdue",
    relatedEntityType: "club_documents", relatedEntityId: docId,
  });
}
