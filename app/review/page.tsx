"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { RichTextViewer } from "@/components/rich-text-editor";

type Member = { id: string; name: string | null; email: string; role: string };
type Draft = { id: string; title: string; body: string; status: string; channel: string; currentVersion: number; assignedToId: string | null; assignedTo: { id: string; name: string | null; email: string } | null; createdBy: { name: string | null }; _count: { comments: number } };
type Comment = { id: string; body: string; createdAt: string; user: { name: string | null } };

export default function ReviewPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const [draftResponse, memberResponse] = await Promise.all([fetch("/api/drafts"), fetch("/api/team/members")]);
    const draftData = await draftResponse.json();
    const memberData = await memberResponse.json();
    if (draftResponse.ok) {
      setDrafts(draftData.drafts);
      for (const item of draftData.drafts) {
        const response = await fetch(`/api/drafts/${item.id}/comments`);
        const data = await response.json();
        if (response.ok) setComments(old => ({ ...old, [item.id]: data.comments }));
        setAssignees(old => ({ ...old, [item.id]: item.assignedToId || "" }));
      }
    } else {
      setMessage(draftData.error || "Could not load review queue.");
    }
    if (memberResponse.ok) setMembers(memberData.members);
  }

  useEffect(() => { void load(); }, []);

  async function action(id: string, path: string) {
    setBusy(id);
    setMessage("");
    const response = await fetch(`/api/drafts/${id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: notes[id] || "" }),
    });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Action failed.");
    else {
      setMessage(path === "approve" ? "Content approved. It can now be scheduled." : path === "submit" ? "Draft submitted for review." : "Changes requested.");
      await load();
    }
    setBusy("");
  }

  async function comment(id: string) {
    const body = notes[id]?.trim();
    if (!body) return;
    setBusy(id);
    const response = await fetch(`/api/drafts/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Comment failed.");
    else {
      setNotes(old => ({ ...old, [id]: "" }));
      setComments(old => ({ ...old, [id]: [...(old[id] || []), data.comment] }));
    }
    setBusy("");
  }

  async function assign(id: string) {
    setBusy(id);
    const response = await fetch(`/api/drafts/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: assignees[id] || null }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Draft assignment updated." : data.error || "Assignment failed.");
    setBusy("");
    if (response.ok) await load();
  }

  const visible = drafts.filter(draft => !["PUBLISHED", "ARCHIVED", "FAILED"].includes(draft.status));

  return (
    <main className="workspace-page">
      <AppNav/>
      <div className="workspace-content">
        <p className="eyebrow">PHASE 4 · HUMAN REVIEW</p>
        <h1>Review studio</h1>
        <p className="page-intro">Reviewers make the decision. Content cannot be scheduled until an authorized human approves it.</p>
        {message && <p className="inline-message" role="status">{message}</p>}
        <section className="workspace-list">
          <h2>Editorial queue <span>{visible.length}</span></h2>
          {visible.length === 0 ? <p className="empty-state">No drafts need attention right now.</p> : visible.map(draft => (
            <article className="review-card" key={draft.id}>
              <div className="review-heading">
                <div><span className="article-source">{draft.channel} · {draft.status.replaceAll("_", " ")}</span><h3>{draft.title}</h3></div>
                <span className="version-chip">v{draft.currentVersion}</span>
              </div>
              <RichTextViewer value={draft.body}/>
              <div className="assignment-row">
                <label>Assigned reviewer/editor<select value={assignees[draft.id] || ""} onChange={event => setAssignees(old => ({ ...old, [draft.id]: event.target.value }))}><option value="">Unassigned</option>{members.map(member => <option key={member.id} value={member.id}>{member.name || member.email} · {member.role}</option>)}</select></label>
                <button className="secondary-button compact" disabled={busy === draft.id} onClick={() => assign(draft.id)}>Assign</button>
              </div>
              <div className="comment-list">{(comments[draft.id] || []).map(comment => <div key={comment.id}><strong>{comment.user.name || "Teammate"}</strong><span>{comment.body}</span></div>)}</div>
              <textarea value={notes[draft.id] || ""} onChange={event => setNotes(old => ({ ...old, [draft.id]: event.target.value }))} rows={2} placeholder="Add a comment or reviewer note…"/>
              <div className="article-actions">
                {["DRAFT", "CHANGES_REQUESTED"].includes(draft.status) && <button disabled={busy === draft.id} onClick={() => action(draft.id, "submit")}>Submit for review</button>}
                {draft.status === "IN_REVIEW" ? <>
                  <button disabled={busy === draft.id} onClick={() => comment(draft.id)}>Comment</button>
                  <button disabled={busy === draft.id} onClick={() => action(draft.id, "request-changes")}>Request changes</button>
                  <button className="primary-button" disabled={busy === draft.id} onClick={() => action(draft.id, "approve")}>Approve</button>
                </> : <button disabled={busy === draft.id} onClick={() => comment(draft.id)}>Comment</button>}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
