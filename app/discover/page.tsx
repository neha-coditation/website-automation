"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";

type Article = { id: string; title: string; description: string | null; canonicalUrl: string; author: string | null; publishedAt: string | null; status: string; source: { name: string } | null };

export default function DiscoverPage() {
  const [articles,setArticles]=useState<Article[]>([]);
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState("");
  async function load() {
    const params=new URLSearchParams(); if(query) params.set("q",query); if(status) params.set("status",status);
    const response=await fetch(`/api/articles?${params.toString()}`); const data=await response.json();
    if(response.ok) setArticles(data.articles); else setMessage(data.error || "Could not load articles.");
  }
  useEffect(()=>{void load();},[status]);
  async function updateArticle(id:string,next:string) {
    setBusy(id); setMessage("");
    const response=await fetch("/api/articles",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({articleId:id,status:next})});
    const data=await response.json(); if(!response.ok) setMessage(data.error || "Update failed."); else await load(); setBusy("");
  }
  async function generate(articleId:string) {
    setBusy(articleId); setMessage("");
    const response=await fetch("/api/drafts/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({articleId,channel:"LINKEDIN"})});
    const data=await response.json();
    if(!response.ok) setMessage(data.error || "Draft generation failed."); else setMessage(`Draft created: ${data.draft.title}`);
    setBusy("");
  }
  return <main className="workspace-page"><AppNav/><div className="workspace-content"><p className="eyebrow">PHASE 2 · DISCOVERY</p><h1>Discover ideas</h1><p className="page-intro">Review source material, save useful stories, and turn a selected article into a first draft.</p>
    <div className="filter-row"><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter") void load();}} placeholder="Search titles and descriptions…"/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option><option value="NEW">New</option><option value="REVIEWED">Reviewed</option><option value="SAVED">Saved</option><option value="DISMISSED">Dismissed</option></select><button className="secondary-button compact" onClick={()=>load()}>Search</button></div>
    {message && <p className="inline-message" role="status">{message}</p>}
    <section className="workspace-list"><h2>Articles <span>{articles.length}</span></h2>{articles.length===0 ? <p className="empty-state">No articles found. Connect a source and sync it to populate discovery.</p> : articles.map(article=><article className="article-card" key={article.id}><div className="article-source">{article.source?.name || "Manual source"} · {article.status}</div><h3>{article.title}</h3><p>{article.description || "No summary available."}</p><div className="article-meta">{article.author || "Unknown author"}{article.publishedAt ? ` · ${new Date(article.publishedAt).toLocaleDateString()}` : ""}</div><a href={article.canonicalUrl} target="_blank" rel="noreferrer">Read original article ↗</a><div className="article-actions"><button disabled={busy===article.id} onClick={()=>updateArticle(article.id,"SAVED")}>Save</button><button disabled={busy===article.id} onClick={()=>updateArticle(article.id,"DISMISSED")}>Dismiss</button><button className="primary-button" disabled={busy===article.id} onClick={()=>generate(article.id)}>Generate draft</button></div></article>)}</section>
  </div></main>;
}
