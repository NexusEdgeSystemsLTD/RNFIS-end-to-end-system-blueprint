import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/app/clubs/")({ component: Clubs });

function Clubs() {
  const [clubs, setClubs] = useState<any[]>([]);
  useEffect(() => {
    supabase
      .from("clubs")
      .select("*, players:players(count)")
      .order("name")
      .then(({ data }) => setClubs(data ?? []));
  }, []);

  return (
    <div className="p-6">
      <PageHeader title="Clubs Registry" subtitle="Premier League licensed clubs" />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {clubs.map((c) => (
          <Link key={c.id} to="/app/clubs/$clubId" params={{ clubId: c.id }}>
            <Card className="panel hover:border-primary/40 transition-colors">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="h-12 w-12 rounded-md grid place-items-center text-white font-bold shrink-0"
                     style={{ backgroundColor: c.primary_color || "#0f172a" }}>
                  {c.short_code}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.city} · est {c.founded_year ?? "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1">{c.home_stadium}</div>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  <Trophy className="h-3 w-3 mr-1" /> {c.players?.[0]?.count ?? 0}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
