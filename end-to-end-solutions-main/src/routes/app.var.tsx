import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/var")({ component: VAR });

function VAR() {
  const [reviews, setReviews] = useState<any[]>([]);
  useEffect(() => {
    supabase
      .from("var_reviews")
      .select("*, match:match_id(id, match_code, home_club:home_club_id(short_code), away_club:away_club_id(short_code))")
      .order("created_at", { ascending: false })
      .then(({ data }) => setReviews(data ?? []));
  }, []);
  return (
    <div className="p-6">
      <PageHeader title="VAR Reviews" subtitle="Video assistant referee decisions and audit trail" />
      {reviews.length === 0 ? (
        <Card className="panel">
          <CardContent className="p-12 text-center text-muted-foreground text-sm">
            No VAR reviews recorded yet. Open a match in <Link to="/app/matches" className="text-primary underline">Matches</Link> and use “Log VAR review”.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reviews.map((r) => (
            <Link key={r.id} to="/app/matches/$matchId" params={{ matchId: r.match?.id }}>
              <Card className="panel hover:border-primary/40 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <span className="font-mono text-primary w-12 text-center">{r.minute}'</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.incident_type}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {r.match?.match_code} · {r.match?.home_club?.short_code} v {r.match?.away_club?.short_code}
                      {r.on_field_decision && ` · on-field: ${r.on_field_decision}`}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">{r.outcome.replace(/_/g, " ")}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
