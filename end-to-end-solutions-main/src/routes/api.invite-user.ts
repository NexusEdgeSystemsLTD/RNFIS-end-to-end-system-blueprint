import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ALLOWED_ROLES: AppRole[] = [
  "ferwafa_admin",
  "club_official",
  "referee",
  "var_officer",
  "public_viewer",
];

export const Route = createFileRoute("/api/invite-user")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Verify caller is ministry_admin
          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.replace(/^Bearer\s+/i, "");
          if (!token) return json({ error: "Missing auth" }, 401);

          const supabaseUrl = process.env.SUPABASE_URL!;
          const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: userData, error: userErr } = await userClient.auth.getUser();
          if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

          const { data: isAdmin } = await userClient.rpc("has_role", {
            _user_id: userData.user.id,
            _role: "ministry_admin",
          });
          if (!isAdmin) return json({ error: "Forbidden — ministry_admin only" }, 403);

          const body = (await request.json()) as {
            email?: string;
            full_name?: string;
            role?: AppRole;
          };
          const email = (body.email ?? "").trim().toLowerCase();
          const fullName = (body.full_name ?? "").trim() || email.split("@")[0];
          const role = body.role as AppRole;

          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return json({ error: "Invalid email" }, 400);
          if (!ALLOWED_ROLES.includes(role))
            return json({ error: "Invalid role" }, 400);

          // Send invite (creates auth user if missing, emails magic link)
          const redirectTo = new URL(request.url).origin + "/reset-password";
          const { data: invite, error: inviteErr } =
            await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
              data: { full_name: fullName },
              redirectTo,
            });

          if (inviteErr || !invite.user) {
            return json({ error: inviteErr?.message ?? "Invite failed" }, 400);
          }

          // Assign role (handle_new_user trigger seeds public_viewer; add the requested role)
          const { error: roleErr } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: invite.user.id, role, assigned_by: userData.user.id });
          if (roleErr && !roleErr.message.includes("duplicate")) {
            return json({ error: roleErr.message }, 400);
          }

          return json({ ok: true, user_id: invite.user.id });
        } catch (e: any) {
          return json({ error: e?.message ?? "Unexpected error" }, 500);
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
