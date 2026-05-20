// AI Briefing — generates governance briefings using Lovable AI Gateway.
// Accepts { kind: "command" | "ministry" | "weekly_governance", stats: object }
// Returns { text, confidence, model }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROMPTS: Record<string, string> = {
  command:
    "You are RNFIS Command AI. Write a 150-word governance briefing summarising today's Rwandan football operations from the JSON data. Use formal but plain English. End with one sentence flagging any anomaly.",
  ministry:
    "You are RNFIS Policy Analyst AI for the Rwanda Ministry of Sports. Write a 400-word policy briefing covering season trends, anomalies, and areas needing intervention based on the JSON data. Aggregate only — never name individual players. Output as Markdown with sections: ## Trends, ## Anomalies, ## Recommendations.",
  weekly_governance:
    "You are RNFIS Reports AI. Draft a Weekly Governance Digest in Markdown using the JSON data. Sections: ## Executive Summary, ## Match Activity, ## Discipline, ## VAR Review, ## Recommendations.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { kind, stats } = await req.json();
    const system = PROMPTS[kind] ?? PROMPTS.command;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: "Aggregate JSON data:\n" + JSON.stringify(stats).slice(0, 8000) },
        ],
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limited, please retry shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!r.ok) {
      const t = await r.text();
      console.error("AI gateway error:", r.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const out = await r.json();
    const text = out.choices?.[0]?.message?.content ?? "(no content)";
    // Heuristic confidence — flag for human review if data thin
    const confidence = Object.keys(stats ?? {}).length >= 4 ? 0.85 : 0.7;
    return new Response(JSON.stringify({ text, confidence, model: "google/gemini-2.5-flash" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
