import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({ component: ResetPassword });

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase puts recovery tokens in the URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setReady(true);
    } else {
      // Listen for PASSWORD_RECOVERY event
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") setReady(true);
      });
      return () => sub.subscription.unsubscribe();
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Sign in to continue.");
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <Card className="panel w-full max-w-md">
        <CardHeader>
          <CardTitle>Set new password</CardTitle>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <div className="text-sm text-muted-foreground">
              This page expects a recovery link. <Link to="/auth" className="text-primary underline">Return to sign in</Link>.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="pw">New password</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
              </div>
              <div>
                <Label htmlFor="pw2">Confirm</Label>
                <Input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Update password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
