"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

export default function InvitePage() {
  const params=useParams<{token:string}>();const router=useRouter();const {data:session,status}=useSession();const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  async function accept(){setBusy(true);const r=await fetch("/api/team/invitations/accept",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:params.token})});const d=await r.json();setMessage(r.ok?"Invitation accepted. Opening your workspace…":d.error||"Could not accept invitation.");if(r.ok)setTimeout(()=>router.push("/"),700);setBusy(false);}
  return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span>✦</span><strong>marketing<span>studio</span></strong></div><h1>Join a workspace</h1><p className="auth-copy">Accept this invitation to collaborate with your team.</p>{status==="loading"?<p>Checking your sign-in…</p>:!session?<button className="primary-button auth-button" onClick={()=>signIn("google",{callbackUrl:`/invite/${params.token}`})}>Sign in to accept</button>:<button className="primary-button auth-button" disabled={busy} onClick={accept}>{busy?"Accepting…":"Accept invitation"}</button>}{message&&<p className="inline-message">{message}</p>}</section></main>;
}
