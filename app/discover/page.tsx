"use client";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";

type Article = { id:string; title:string; description:string|null; canonicalUrl:string; author:string|null; publishedAt:string|null; status:string; source:{name:string}|null };

export default function DiscoverPage() {
  const [articles,setArticles]=useState<Article[]>([]);
  const [query,setQuery]=useState("");
  const [newsQuery,setNewsQuery]=useState("");
  const [status,setStatus]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState("");
  async function load() {
    const params=new URLSearchParams();
    if(query) params.set("q",query);
    if(status) params.set("status",status);
    const r=await fetch("/api/articles?"+params.toString());
    const d=await r.json();
    if(r.ok) setArticles(d.articles); else setMessage(d.error||"Could not load articles.");
  }
  useEffect(()=>{void load();},[status]);
  async function searchNews() {
    if(!newsQuery.trim()) return;
    setMessage("Searching news provider…");
    const r=await fetch("/api/discovery/news-search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:newsQuery})});
    const d=await r.json();
    if(!r.ok) setMessage(d.error||"News search failed.");
    else {setMessage("Saved "+d.saved+" articles from "+d.returned+" results.");await load();}
  }
  async function updateArticle(id:string,next:string) {
    setBusy(id);
    const r=await fetch("/api/articles",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({articleId:id,status:next})});
    const d=await r.json();
    if(!r.ok) setMessage(d.error||"Update failed."); else await load();
    setBusy("");
  }
  async function generate(id:string) {
    setBusy(id);
    const r=await fetch("/api/drafts/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({articleId:id,channel:"LINKEDIN"})});
    const d=await r.json();
    setMessage(r.ok?"Draft created: "+d.draft.title:(d.error||"Draft generation failed."));
    setBusy("");
  }
  return <main className="workspace-page"><AppNav/><div className="workspace-content">
    <p className="eyebrow">PHASE 2 · DISCOVERY</p><h1>Discover ideas</h1>
    <p className="page-intro">Review source material, save useful stories, and turn a selected article into a first draft.</p>
    <div className="filter-row">
      <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void load();}} placeholder="Search titles and descriptions…"/>
      <select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option><option value="NEW">New</option><option value="REVIEWED">Reviewed</option><option value="SAVED">Saved</option><option value="DISMISSED">Dismissed</option></select>
      <button className="secondary-button compact" onClick={()=>load()}>Search</button>
      <input value={newsQuery} onChange={e=>setNewsQuery(e.target.value)} placeholder="Search news provider…"/>
      <button className="secondary-button compact" onClick={searchNews}>Search news</button>
    </div>
    {message&&<p className="inline-message" role="status">{message}</p>}
    <section className="workspace-list"><h2>Articles <span>{articles.length}</span></h2>
      {articles.length===0?<p className="empty-state">No articles found. Connect a source and sync it to populate discovery.</p>:articles.map(a=><article className="article-card" key={a.id}>
        <div className="article-source">{a.source?.name||"Manual source"} · {a.status}</div><h3>{a.title}</h3><p>{a.description||"No summary available."}</p>
        <div className="article-meta">{a.author||"Unknown author"}{a.publishedAt?" · "+new Date(a.publishedAt).toLocaleDateString():""}</div>
        <a href={a.canonicalUrl} target="_blank" rel="noreferrer">Read original article ↗</a>
        <div className="article-actions"><button disabled={busy===a.id} onClick={()=>updateArticle(a.id,"SAVED")}>Save</button><button disabled={busy===a.id} onClick={()=>updateArticle(a.id,"DISMISSED")}>Dismiss</button><button className="primary-button" disabled={busy===a.id} onClick={()=>generate(a.id)}>Generate draft</button></div>
      </article>)}
    </section>
  </div></main>;
}
