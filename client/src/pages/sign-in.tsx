import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "@/components/auth-provider";

export default function SignIn() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    const { error } = await signInWithEmail(email.trim());
    setSending(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-primary">
            <BrandMark />
          </span>
          <h1 className="font-serif text-xl font-semibold text-foreground">
            Quiet Hours
          </h1>
          <p className="font-serif text-sm italic text-muted-foreground">
            A gentler toolkit for the parts of you that try to do everything.
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            {sent ? (
              <div
                className="space-y-3 text-center"
                data-testid="text-magic-sent"
              >
                <p className="font-serif text-base text-foreground">
                  Check your email.
                </p>
                <p className="font-serif text-sm italic text-muted-foreground">
                  We sent a sign-in link to{" "}
                  <span className="not-italic text-foreground">{email}</span>.
                  Click it and you'll land back here, signed in. No password to
                  remember.
                </p>
                <p className="text-xs text-muted-foreground">
                  It can take a minute. Check spam if it doesn't arrive.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                  }}
                  data-testid="button-sign-in-different"
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    data-testid="input-email"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" data-testid="text-auth-error">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={sending || !email.trim()}
                  data-testid="button-send-magic-link"
                >
                  {sending ? "Sending…" : "Send me a sign-in link"}
                </Button>
                <p className="text-center font-serif text-xs italic text-muted-foreground">
                  No password. We'll email you a one-time link.
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="space-y-2 text-center text-xs text-muted-foreground">
          <p>
            Your data is stored in a private database and only ever visible to
            you. Not medical advice.
          </p>
          <p>
            In crisis? In the US, call or text{" "}
            <a
              href="tel:988"
              className="text-accent-foreground underline underline-offset-2"
            >
              988
            </a>
            . International:{" "}
            <a
              href="https://findahelpline.com"
              target="_blank"
              rel="noreferrer"
              className="text-accent-foreground underline underline-offset-2"
            >
              findahelpline.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
