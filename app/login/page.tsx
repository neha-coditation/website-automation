"use client";

import { signIn } from "next-auth/react";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><span><Sparkles size={20}/></span><strong>marketing<span>studio</span></strong></div>
        <p className="eyebrow">CONTENT OPERATIONS</p>
        <h1>Welcome to your workspace.</h1>
        <p className="auth-copy">Discover useful ideas, create thoughtful content, and keep people in control of every approval.</p>
        <button className="primary-button auth-button" onClick={() => signIn("google", { callbackUrl: "/" })}>Continue with Google</button>
        <p className="auth-note">Your organization workspace is provisioned after your first successful sign-in. Access is restricted to authenticated members.</p>
      </section>
    </main>
  );
}
