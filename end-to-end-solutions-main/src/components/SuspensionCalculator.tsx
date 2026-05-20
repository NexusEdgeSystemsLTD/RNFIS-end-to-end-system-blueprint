import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator } from "lucide-react";
import { calculateSuspension, type Incident, type SuspensionRuling } from "@/lib/engines";

const INCIDENTS: { v: Incident; label: string }[] = [
  { v: "yellow_accumulation", label: "Yellow card accumulation" },
  { v: "second_yellow", label: "Second yellow (caution)" },
  { v: "red_card", label: "Direct red card" },
  { v: "dogso", label: "Denial of obvious goal-scoring opportunity" },
  { v: "violent_conduct", label: "Violent conduct" },
  { v: "abusive_language", label: "Foul and abusive language" },
  { v: "disrepute", label: "Bringing the game into disrepute" },
  { v: "spitting", label: "Spitting" },
];

export function SuspensionCalculator() {
  const [incident, setIncident] = useState<Incident>("yellow_accumulation");
  const [prior, setPrior] = useState("0");
  const [result, setResult] = useState<SuspensionRuling | null>(null);

  const calc = () => setResult(calculateSuspension(incident, { prior_offences: parseInt(prior) || 0 }));

  return (
    <Dialog onOpenChange={(o) => !o && setResult(null)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Calculator className="h-4 w-4 mr-2" /> Suspension calculator</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>FERWAFA Suspension Calculator</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>Incident type</Label>
            <Select value={incident} onValueChange={(v) => setIncident(v as Incident)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INCIDENTS.map((i) => <SelectItem key={i.v} value={i.v}>{i.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Prior similar offences this season</Label>
            <Input type="number" min={0} max={10} value={prior} onChange={(e) => setPrior(e.target.value)} />
          </div>
          <Button onClick={calc} className="w-full">Calculate sanction</Button>
          {result && (
            <div className="p-3 bg-muted rounded space-y-1 text-sm">
              <div className="font-bold">{result.matches} match suspension · RWF {result.fine.toLocaleString()} fine</div>
              <div className="text-xs text-muted-foreground">{result.article}</div>
              <div className="text-xs">{result.explanation}</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
