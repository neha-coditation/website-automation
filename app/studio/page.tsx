"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { RichTextEditor, RichTextViewer } from "@/components/rich-text-editor";

type Draft = { id: string; title: string; body: string; channel: string; status: string; currentVersion: number; updatedAt: string };
type Version = { id: string; version: number; title: string; body: string; createdAt: string };

export default function StudioPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState("LINKEDIN");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [historyFor, setHistoryFor] = useState("");

  async function load() {
    const response = await fetch("/api/drafts");
    const data = await response.json();
    if (response.ok) setDrafts(data.drafts);
    else setMessage(data.error || "Could not load drafts.");
  }

  useEffect(() => { void load(); }, []);

  function startEdit(draft: Draft) {
    setEditing(draft);
    setTitle(draft.title);
    setBody(draft.body);
    setChannel(draft.channel);
    setRewriteInstruction("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    setTitle("");
    setBody("");
    setChannel("LINKEDIN");
    setRewriteInstruction("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(editing ? `/api/drafts/${editing.id}` : "/api/drafts", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing
          ? { title, body, expectedVersion: editing.currentVersion }
          : { title, body, channel }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save draft.");
      setMessage(editing ? "Draft updated and version history saved." : "Draft saved. Submit it for human review when ready.");
      cancelEdit();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save draft.");
    } finally {
      setBusy(false);
    }
  }

  async function rewrite() {
    if (!editing || !rewriteInstruction.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/drafts/${editing.id}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: rewriteInstruction, expectedVersion: editing.currentVersion }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI rewrite failed.");
      setTitle(data.title);
      setBody(data.body);
      setEditing({ ...editing, title: data.title, body: data.body, currentVersion: data.version });
      setRewriteInstruction("");
      setMessage("AI rewrite added as a new draft version. Review it before saving or submitting.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI rewrite failed.");
    } finally {
      setBusy(false);
    }
  }

  async function showHistory(draft: Draft) {
    setHistoryFor(draft.id);
    const response = await fetch(`/api/drafts/${draft.id}/versions`);
    const data = await response.json();
    if (response.ok) setVersions(data.versions);
    else setMessage(data.error || "Could not load version history.");
  }

  return (
    <main className="workspace-page">
      <AppNav />
      <div className="workspace-content">
        <p className="eyebrow">PHASE 3 · AI CONTENT STUDIO</p>
        <h1>Content studio</h1>
        <p className="page-intro">Create, edit and refine drafts. AI-assisted changes are versioned and never approved automatically.</p>
        {message && <p className="inline-message" role="status">{message}</p>}
        <form className="workspace-form draft-form" onSubmit={save}>
          <label>Headline<input value={title} onChange={event => setTitle(event.target.value)} required maxLength={240} placeholder="Give your content a clear headline"/></label>
          <label>Channel<select value={channel} onChange={event => setChannel(event.target.value)} disabled={!!editing}><option value="LINKEDIN">LinkedIn</option><option value="BLOG">Blog</option><option value="NEWSLETTER">Newsletter</option></select></label>
          <label>Draft content<RichTextEditor value={body} onChange={setBody}/></label>
          {editing && <label>AI rewrite instruction<input value={rewriteInstruction} onChange={event => setRewriteInstruction(event.target.value)} placeholder="e.g. Make the opening more direct and concise"/></label>}
          <div className="article-actions">
            <button className="primary-button" disabled={busy}>{busy ? "Saving…" : editing ? "Save new version" : "Save draft"}</button>
            {editing && <><button type="button" disabled={busy || !rewriteInstruction.trim()} onClick={rewrite}>Rewrite with AI</button><button type="button" disabled={busy} onClick={cancelEdit}>Cancel edit</button></>}
          </div>
        </form>
        <section className="workspace-list">
          <h2>Draft library <span>{drafts.length}</span></h2>
          {drafts.length === 0 ? <p className="empty-state">Your drafts will appear here. Start by discovering an article or writing a draft above.</p> : drafts.map(draft => (
            <article className="workspace-list-row" key={draft.id}>
              <div>
                <strong>{draft.title}</strong>
                <small>{draft.channel} · {draft.status.replaceAll("_", " ")} · v{draft.currentVersion} · Updated {new Date(draft.updatedAt).toLocaleString()}</small>
                <div className="draft-preview"><RichTextViewer value={draft.body}/></div>
              </div>
              <div className="draft-actions">
                {["DRAFT", "CHANGES_REQUESTED"].includes(draft.status) && <button className="secondary-button compact" onClick={() => startEdit(draft)}>Edit</button>}
                <button className="secondary-button compact" onClick={() => showHistory(draft)}>History</button>
                <a className="small-link" href="/review">Review →</a>
              </div>
            </article>
          ))}
        </section>
        {historyFor && <section className="workspace-list"><div className="section-title"><h2>Version history</h2><button className="text-button" onClick={() => setHistoryFor("")}>Close</button></div>{versions.map(version => <article className="version-row" key={version.id}><strong>Version {version.version} · {version.title}</strong><small>{new Date(version.createdAt).toLocaleString()}</small><RichTextViewer value={version.body}/></article>)}</section>}
      </div>
    </main>
  );
}
