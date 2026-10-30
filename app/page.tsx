"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowUpRight, CalendarDays, CheckCheck, FileText, Lightbulb, Plus, Rss, Sparkles, Users, WandSparkles } from "lucide-react";
import { AppNav } from "@/components/app-nav";

type Overview = {
  workspace: { name: string; role: string };
  metrics: { articleCount: number; draftCount: number; reviewCount: number; publishedCount: number };
  recentDrafts: { id: string; title: string; channel: string; status: string; owner: string; updatedAt: string }[];
  sources: { id: string; name: string; type: string; articles: number; status: string }[];
};

export default function Home() {
  const { data: session } = useSession();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/overview").then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load workspace overview.");
      setData(result as Overview);
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Could not load workspace overview."));
  }, []);
  const metrics = [
    { label: "Topics discovered", value: data?.metrics.articleCount, icon: Lightbulb, tone: "blue" },
    { label: "Drafts in progress", value: data?.metrics.draftCount, icon: FileText, tone: "violet" },
    { label: "Awaiting review", value: data?.metrics.reviewCount, icon: CheckCheck, tone: "amber" },
    { label: "Published this month", value: data?.metrics.publishedCount, icon: CalendarDays, tone: "green" },
  ];
  const review = data?.recentDrafts.filter(draft => ["IN_REVIEW", "CHANGES_REQUESTED"].includes(draft.status)) || [];
  return (
    <main className="workspace-page">
      <AppNav />
      <div className="workspace-content">
        <p className="eyebrow">WORKSPACE OVERVIEW</p>
        <div className="welcome-row">
          <div><h1>Welcome back, {session?.user?.name?.split(" ")[0] || "there"}</h1><p className="page-intro">{data?.workspace.name || "Your workspace"} · {data?.workspace.role || "Loading workspace"}</p></div>
          <button className="primary-button" onClick={() => { window.location.href = "/studio"; }}><Plus size={16}/> Create content</button>
        </div>
        {error && <p className="inline-message" role="alert">{error}</p>}
        <section className="metric-grid">
          {metrics.map(metric => { const Icon = metric.icon; return <article className="metric-card" key={metric.label}><div className="metric-top"><span>{metric.label}</span><div className={`metric-icon ${metric.tone}`}><Icon size={17}/></div></div><div className="metric-value">{metric.value ?? "—"}</div><div className="metric-foot">Live workspace data</div></article>; })}
        </section>
        <section className="feature-banner">
          <div className="banner-orb orb-one"/><div className="banner-orb orb-two"/>
          <div className="banner-content"><div className="banner-kicker"><Sparkles size={14}/> AI-ASSISTED CONTENT OPERATIONS</div><h2>Turn great ideas into<br/>content that moves people.</h2><p>Discover relevant stories, shape them with AI, and bring every draft through thoughtful human review.</p><div className="banner-actions"><button className="banner-button" onClick={() => { window.location.href = "/discover"; }}>Explore discovery <ArrowUpRight size={15}/></button><span><span className="live-dot"/> Human approval stays in control</span></div></div>
          <div className="banner-art"><div className="art-card art-card-front"><div className="art-spark"><Sparkles size={21}/></div><div className="art-tag">AI DRAFT</div><div className="art-title">Ideas, shaped<br/>with intention.</div><div className="art-lines"><i/><i/><i/></div><div className="art-approved"><CheckCheck size={13}/> Human reviewed</div></div></div>
        </section>
        <section className="content-grid">
          <div className="panel-card">
            <div className="section-title"><div><div className="eyebrow">KEEP THINGS MOVING</div><h2>Your review queue</h2></div><a className="text-button" href="/review">View all <ArrowUpRight size={14}/></a></div>
            {review.length === 0 ? <p className="empty-state">No drafts waiting for review.</p> : review.map(draft => <article className="task-row" key={draft.id}><div className="task-file"><FileText size={18}/></div><div className="task-main"><strong>{draft.title}</strong><span>{draft.channel} · {draft.owner}</span><small className="article-source">{draft.status.replaceAll("_", " ")} · {new Date(draft.updatedAt).toLocaleDateString()}</small></div><a className="row-arrow" href="/review"><ArrowUpRight size={16}/></a></article>)}
          </div>
          <div className="panel-card">
            <div className="section-title"><div><div className="eyebrow">DISCOVERY INPUTS</div><h2>Connected sources</h2></div><a className="text-button" href="/sources">Manage <ArrowUpRight size={14}/></a></div>
            {!data?.sources.length ? <p className="empty-state">Connect your first RSS feed to start discovering articles.</p> : data.sources.map(source => <article className="source-row" key={source.id}><div className="source-logo">{source.name.slice(0,1)}</div><div className="source-main"><strong>{source.name}</strong><span>{source.type} · {source.articles} articles</span><small>{source.status}</small></div></article>)}
            <button className="secondary-button" onClick={() => { window.location.href = "/sources"; }}><Rss size={15}/> Manage sources</button>
          </div>
        </section>
        <section className="bottom-grid">
          <div className="panel-card"><div className="eyebrow">QUICK ACTIONS</div><h2>Start with an idea</h2><div className="quick-actions">
            <button onClick={() => { window.location.href = "/studio"; }}><div className="quick-icon purple"><WandSparkles size={18}/></div><span><strong>Generate a draft</strong><small>Turn a source into platform-ready content</small></span><ArrowUpRight size={16}/></button>
            <button onClick={() => { window.location.href = "/team"; }}><div className="quick-icon green"><Users size={18}/></div><span><strong>Invite your team</strong><small>Bring reviewers into your workflow</small></span><ArrowUpRight size={16}/></button>
          </div></div>
          <div className="panel-card"><div className="eyebrow">CONTENT WORKFLOW</div><h2>Discover → Create → Review → Publish</h2><p className="panel-subtitle">Every post passes through human review before it can be scheduled.</p><a className="text-button" href="/calendar">Open publishing calendar <ArrowUpRight size={14}/></a></div>
        </section>
      </div>
    </main>
  );
}
