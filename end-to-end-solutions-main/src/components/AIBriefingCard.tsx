import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AIBriefingCard({ kind, stats, title, description }: {
  kind: "command" | "ministry" | "weekly_governance";
  stats: Record<string, any>;
  title: string;
  description: string;
}) {
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-briefing", { body: { kind, stats } });
      if (error) throw error;
      if ((data as any)?.error) { toast.error((data as any).error); return; }
      setText((data as any).text);
      setConfidence((data as any).confidence);
    } catch (e: any) {
      toast.error(e.message ?? "AI briefing failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {confidence != null && (
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${confidence < 0.75 ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}`}>
              conf {(confidence * 100).toFixed(0)}%
            </span>
          )}
          <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Generate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {text ? (
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap text-sm">{text}</div>
        ) : (
          <p className="text-sm text-muted-foreground">No briefing yet. Click Generate to produce an AI summary using anonymised aggregate data.</p>
        )}
        {confidence != null && confidence < 0.75 && <div className="mt-3 text-xs text-warning">⚠ Low confidence — human review recommended.</div>}
      </CardContent>
    </Card>
  );
}
