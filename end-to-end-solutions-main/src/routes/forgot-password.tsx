import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPassword });

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Recovery email sent");
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <Card className="panel w-full max-w-md">
        <CardHeader>
          <CardTitle>Recover access</CardTitle>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-sm">
              <p>If an account exists for <span className="font-mono">{email}</span>, a recovery link has been sent.</p>
              <Link to="/auth" className="inline-flex items-center text-primary hover:underline"><ArrowLeft className="h-3 w-3 mr-1" /> Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@gov.rw" />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Send recovery link
              </Button>
              <Link to="/auth" className="block text-xs text-muted-foreground hover:text-foreground text-center">Back to sign in</Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
