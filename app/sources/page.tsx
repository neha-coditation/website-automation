"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";

type Source = { id: string; name: string; url: string; type: string; status: string; lastFetchedAt: string | null; lastError: string | null; _count: { articles: number } };

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("RSS");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/sources");
    const data = await response.json();
    if (response.ok) setSources(data.sources);
    else setMessage(data.error || "Could not load sources.");
  }
  useEffect(() => { void load(); }, []);

  async function addSource(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, url, type }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add source.");
      setName(""); setUrl(""); setMessage("Source connected. Run a sync to discover articles."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add source."); }
    finally { setBusy(false); }
  }

  async function toggle(source: Source) {
    setBusy(true);
    const nextStatus = source.status === "PAUSED" ? "ACTIVE" : "PAUSED";
    const response = await fetch("/api/sources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: source.id, status: nextStatus }),
    });
    const data = await response.json();
    setMessage(response.ok ? (nextStatus === "PAUSED" ? "Source paused." : "Source resumed.") : data.error || "Could not update source.");
    await load();
    setBusy(false);
  }

  async function sync(id: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/sources/${id}/sync`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sync failed.");
      setMessage(`Sync complete: ${data.inserted} new articles, ${data.updated} updated.`); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sync failed."); await load(); }
    finally { setBusy(false); }
  }

  return <main className="workspace-page"><AppNav/><div className="workspace-content"><p className="eyebrow">PHASE 2 · DISCOVERY</p><h1>Content sources</h1><p className="page-intro">Connect RSS and Atom feeds. Each sync safely fetches the feed and deduplicates articles inside your workspace.</p>
    <form className="workspace-form source-form" onSubmit={addSource}><label>Source name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. The New Stack" required maxLength={120}/></label><label>Feed URL<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com/feed.xml" required/></label><label>Type<select value={type} onChange={e=>setType(e.target.value)}><option value="RSS">RSS / Atom</option><option value="BLOG">Blog feed</option></select></label><button className="primary-button" disabled={busy}>{busy ? "Working…" : "Add source"}</button></form>
    {message && <p className="inline-message" role="status">{message}</p>}
    <section className="workspace-list"><h2>Connected sources <span>{sources.length}</span></h2>{sources.length===0 ? <p className="empty-state">No sources yet. Add an RSS feed above to begin discovery.</p> : sources.map(source=><article className="workspace-list-row" key={source.id}><div><strong>{source.name}</strong><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a><small>{source._count.articles} articles · {source.lastFetchedAt ? `Last synced ${new Date(source.lastFetchedAt).toLocaleString()}` : "Not synced yet"} · {source.status}</small>{source.lastError && <small className="error-text">{source.lastError}</small>}</div><div className="article-actions"><button className="secondary-button compact" disabled={busy || source.status==="PAUSED"} onClick={()=>sync(source.id)}>Sync now</button><button className="secondary-button compact" disabled={busy} onClick={()=>toggle(source)}>{source.status==="PAUSED"?"Resume":"Pause"}</button></div></article>)}</section>
  </div></main>;
}
