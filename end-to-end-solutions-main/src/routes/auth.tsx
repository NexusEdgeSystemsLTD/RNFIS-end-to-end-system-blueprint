import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/app" });
  }, [user, authLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) toast.error(error);
    else {
      toast.success("Welcome back");
      navigate({ to: "/app" });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);
    if (error) toast.error(error);
    else toast.success("Account created. Check your email to confirm before signing in.", { duration: 6000 });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-card to-background border-r border-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground font-bold">
            RW
          </div>
          <div>
            <div className="font-bold tracking-wider">RNFIS</div>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase">
              Ministry of Sports · FERWAFA
            </div>
          </div>
        </Link>
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card/50 text-xs font-mono text-muted-foreground mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> RESTRICTED ACCESS
          </div>
          <h2 className="text-3xl font-bold mb-4">Sovereign Intelligence Console</h2>
          <p className="text-muted-foreground leading-relaxed max-w-md">
            Authentication is required. All access events are logged in the immutable audit ledger
            in compliance with Rwanda Data Protection Law No. 058/2021.
          </p>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          KIGALI-DC1 · TLS-1.3 · 99.9% SLA
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground font-bold text-sm">RW</div>
              <span className="font-bold tracking-wider">RNFIS</span>
            </Link>
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Request access</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gov.rw" />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Authenticate
                </Button>
                <div className="text-right">
                  <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                    Forgot password?
                  </Link>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="fullname">Full name</Label>
                  <Input id="fullname" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gov.rw" />
                </div>
                <div>
                  <Label htmlFor="password2">Password</Label>
                  <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Submit request
                </Button>
                <p className="text-xs text-muted-foreground">
                  New accounts default to <span className="font-mono text-foreground">public_viewer</span>. Elevated roles must be granted by a Ministry administrator.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
