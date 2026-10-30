"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { RichTextEditor } from "@/components/rich-text-editor";

type Draft={id:string;title:string;body:string;channel:string;status:string;currentVersion:number;updatedAt:string};
export default function StudioPage(){
 const [drafts,setDrafts]=useState<Draft[]>([]);const [title,setTitle]=useState("");const [body,setBody]=useState("");const [channel,setChannel]=useState("LINKEDIN");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 async function load(){const r=await fetch("/api/drafts");const d=await r.json();if(r.ok)setDrafts(d.drafts);else setMessage(d.error||"Could not load drafts.");}
 useEffect(()=>{void load();},[]);
 async function create(e:FormEvent){e.preventDefault();setBusy(true);setMessage("");try{const r=await fetch("/api/drafts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,body,channel})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not create draft.");setTitle("");setBody("");setMessage("Draft saved. Submit it for human review when ready.");await load();}catch(err){setMessage(err instanceof Error?err.message:"Could not save draft.");}finally{setBusy(false);}}
 return <main className="workspace-page"><AppNav/><div className="workspace-content"><p className="eyebrow">PHASE 3 · AI CONTENT STUDIO</p><h1>Content studio</h1><p className="page-intro">Create and refine drafts. AI-assisted drafts are saved as editable drafts and never approved automatically.</p>
 {message&&<p className="inline-message" role="status">{message}</p>}
 <form className="workspace-form draft-form" onSubmit={create}><label>Headline<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={240} placeholder="Give your content a clear headline"/></label><label>Channel<select value={channel} onChange={e=>setChannel(e.target.value)}><option value="LINKEDIN">LinkedIn</option><option value="BLOG">Blog</option><option value="NEWSLETTER">Newsletter</option></select></label><label>Draft content<RichTextEditor value={body} onChange={setBody}/></label><button className="primary-button" disabled={busy}>{busy?"Saving…":"Save draft"}</button></form>
 <section className="workspace-list"><h2>Draft library <span>{drafts.length}</span></h2>{drafts.length===0?<p className="empty-state">Your drafts will appear here. Start by discovering an article or writing a draft above.</p>:drafts.map(d=><article className="workspace-list-row" key={d.id}><div><strong>{d.title}</strong><small>{d.channel} · {d.status.replaceAll("_"," ")} · v{d.currentVersion} · Updated {new Date(d.updatedAt).toLocaleString()}</small><p className="draft-preview">{d.body.slice(0,220)}{d.body.length>220?"…":""}</p></div><a className="small-link" href="/review">Open review →</a></article>)}</section>
 </div></main>;
}
