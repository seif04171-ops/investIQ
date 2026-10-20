"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignUpPage() {
  const { signup } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(email, password, displayName || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free. Includes a $100,000 paper-trading book."
      footer={<>Already have an account? <Link href="/sign-in" className="font-medium text-primary hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Name (optional)"><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" placeholder="What should we call you?" className="h-11" /></Field>
        <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-11" /></Field>
        <Field label="Password" hint="At least 8 characters."><Input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a password" className="h-11" /></Field>
        {error && <div role="alert" className="rounded-xl border border-negative/25 bg-negative/[0.06] px-3.5 py-2.5 text-sm text-negative">{error}</div>}
        <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">Create account</Button>
        <p className="text-center text-xs text-dim">Research tool only — not personal investment advice.</p>
      </form>
    </AuthShell>
  );
}
