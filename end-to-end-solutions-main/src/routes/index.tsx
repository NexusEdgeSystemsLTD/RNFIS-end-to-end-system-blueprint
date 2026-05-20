import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Activity, Database, Lock, Trophy, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground font-bold text-sm">
              RW
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wider">RNFIS</div>
              <div className="text-[10px] text-muted-foreground tracking-widest uppercase">
                Ministry of Sports · FERWAFA
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/live">
              <Button variant="ghost" size="sm">Live scores</Button>
            </Link>
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Access Portal</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card/50 text-xs font-mono text-muted-foreground mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            CLASSIFICATION · RESTRICTED — INTERNAL USE
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Rwanda National Football <span className="text-primary">Intelligence System</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            A sovereign, AI-augmented governance platform commissioned by the Ministry of Sports and
            developed in partnership with FERWAFA. Unified match intelligence, immutable audit trails,
            real-time discipline management, and CAF-aligned compliance — all on Rwandan infrastructure.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg">Enter Command Console</Button>
            </Link>
            <Link to="/live">
              <Button size="lg" variant="outline">Public live scores</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="container mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Activity, title: "Live Match Intelligence", desc: "Event-sourced match reporting with zero data loss during fixtures." },
            { icon: Trophy, title: "Player & Club Registry", desc: "Centralized licensing, conduct history, and roster management." },
            { icon: ShieldCheck, title: "Discipline Engine", desc: "Automated sanction tracking, appeals, and enforcement workflows." },
            { icon: BarChart3, title: "Performance Analytics", desc: "Rankings, form trends, and AI-assisted referee evaluation." },
            { icon: Database, title: "Data Sovereignty", desc: "All Rwandan football data hosted on Rwandan infrastructure (Law No. 058/2021)." },
            { icon: Lock, title: "Immutable Audit Ledger", desc: "Every governance action permanently logged and verifiable." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="panel p-6">
              <Icon className="h-8 w-8 text-primary mb-4" />
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground font-mono">
        RNFIS v1.0 · Sovereign · GDPR-equivalent (Law No. 058/2021) · CAF Compliance Pathway
      </footer>
    </div>
  );
}
