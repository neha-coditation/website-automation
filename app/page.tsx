"use client";

import {
  ArrowUpRight, Bell, CalendarDays, CheckCheck, ChevronDown, CircleHelp,
  Clock3, FileText, Filter, LayoutDashboard, Lightbulb, MessageSquare,
  Plus, Search, Settings2, Sparkles, Users, WandSparkles, Rss,
  ChartNoAxesCombined, CircleAlert, type LucideIcon
} from "lucide-react";

type NavigationGroup = { label: string; items: { label: string; icon: LucideIcon; active?: boolean; count?: string }[] };

const navGroups: NavigationGroup[] = [
  { label: "WORKSPACE", items: [
    { label: "Overview", icon: LayoutDashboard, active: true },
    { label: "Discover", icon: Lightbulb, count: "24" },
    { label: "Content studio", icon: WandSparkles },
    { label: "Content library", icon: FileText }
  ]},
  { label: "PUBLISHING", items: [
    { label: "Review queue", icon: CheckCheck, count: "6" },
    { label: "Calendar", icon: CalendarDays },
    { label: "Campaigns", icon: Sparkles }
  ]},
  { label: "MANAGE", items: [
    { label: "Team", icon: Users },
    { label: "Sources", icon: Rss },
    { label: "Analytics", icon: ChartNoAxesCombined },
    { label: "Settings", icon: Settings2 }
  ]}
];

const metrics = [
  { label: "Topics discovered", value: "128", change: "+18 this week", icon: Lightbulb, tone: "blue" },
  { label: "Drafts in progress", value: "18", change: "4 generated today", icon: FileText, tone: "violet" },
  { label: "Awaiting review", value: "06", change: "2 need your attention", icon: Clock3, tone: "amber" },
  { label: "Published this month", value: "32", change: "+12% vs last month", icon: CheckCheck, tone: "green" }
];

const tasks = [
  { title: "The next phase of enterprise AI adoption", channel: "LinkedIn · Company page", owner: "Ananya Shah", status: "Needs review", tone: "amber", time: "Today, 2:40 PM" },
  { title: "Why modern data platforms need better governance", channel: "Blog · 1,200 words", owner: "You", status: "Changes requested", tone: "rose", time: "Today, 11:15 AM" },
  { title: "Five engineering trends worth watching", channel: "LinkedIn · Thought leadership", owner: "Rahul Mehta", status: "Ready to approve", tone: "green", time: "Yesterday" }
];

const sources = [
  { name: "TechCrunch", topic: "Enterprise technology", time: "12 min ago", score: "94" },
  { name: "The New Stack", topic: "Software engineering", time: "38 min ago", score: "89" },
  { name: "MIT Technology Review", topic: "Artificial intelligence", time: "1 hr ago", score: "86" }
];

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: string }) {
  return <div className="section-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2></div>{action && <button className="text-button">{action}<ArrowUpRight size={15}/></button>}</div>;
}

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={19}/></div>
          <div><div className="brand-name">marketing<span>studio</span></div><div className="brand-caption">CONTENT OPERATIONS</div></div>
        </div>
        <button className="workspace-switch"><div className="workspace-avatar">C</div><div className="workspace-copy"><strong>Coditation</strong><span>Workspace</span></div><ChevronDown size={15}/></button>
        <nav className="main-nav">
          {navGroups.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item => { const Icon = item.icon; return <a href="#" className={`nav-item ${item.active ? "active" : ""}`} key={item.label}><Icon size={17}/><span>{item.label}</span>{item.count && <small>{item.count}</small>}</a>; })}</div>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-card"><div className="plan-icon"><Sparkles size={15}/></div><strong>Your workspace is ready</strong><p>Connect your first content source to start discovering ideas.</p><button onClick={() => window.alert("Source connections are coming in the next implementation phase.")}>Connect a source <ArrowUpRight size={14}/></button></div>
          <div className="profile-row"><div className="profile-avatar">NP</div><div className="profile-copy"><strong>Neha Patil</strong><span>Workspace admin</span></div><button className="icon-button" aria-label="Help"><CircleHelp size={17}/></button></div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> Overview</div><div className="top-actions"><div className="search-box"><Search size={16}/><input aria-label="Search" placeholder="Search anything..." /><kbd>⌘ K</kbd></div><button className="icon-button notification" aria-label="Notifications"><Bell size={18}/><i/></button><div className="top-avatar">NP</div></div></header>
        <div className="page-content">
          <section className="welcome-row"><div><div className="eyebrow">FRIDAY, OCTOBER 30, 2026</div><h1>Good evening, Neha <span>✦</span></h1><p>Here’s what’s happening across your content workspace.</p></div><button className="primary-button"><Plus size={17}/> Create content</button></section>

          <section className="metric-grid">{metrics.map(metric => { const Icon = metric.icon; return <article className="metric-card" key={metric.label}><div className="metric-top"><span>{metric.label}</span><div className={`metric-icon ${metric.tone}`}><Icon size={17}/></div></div><div className="metric-value">{metric.value}</div><div className="metric-foot">{metric.change}</div></article>; })}</section>

          <section className="feature-banner"><div className="banner-orb orb-one"/><div className="banner-orb orb-two"/><div className="banner-content"><div className="banner-kicker"><Sparkles size={14}/> YOUR AI CONTENT WORKSPACE</div><h2>Turn great ideas into<br/>content that moves people.</h2><p>Discover relevant stories, shape them with AI, and bring every draft through a thoughtful human review.</p><div className="banner-actions"><button className="banner-button">Explore content studio <ArrowUpRight size={15}/></button><span><span className="live-dot"/> Human approval stays in control</span></div></div><div className="banner-art"><div className="art-card art-card-back"><div className="art-lines"><i/><i/><i/><i/></div></div><div className="art-card art-card-front"><div className="art-spark"><Sparkles size={21}/></div><div className="art-tag">AI DRAFT</div><div className="art-title">Ideas, shaped<br/>with intention.</div><div className="art-lines"><i/><i/><i/></div><div className="art-approved"><CheckCheck size={13}/> Human reviewed</div></div></div></section>

          <section className="content-grid">
            <div className="panel-card review-panel"><SectionTitle eyebrow="KEEP THINGS MOVING" title="Your review queue" action="View all"/><div className="panel-subtitle">Content waiting for your team&apos;s attention.</div><div className="task-list">{tasks.map((task, index) => <article className="task-row" key={task.title}><div className="task-file"><FileText size={18}/></div><div className="task-main"><strong>{task.title}</strong><span>{task.channel}</span><div className="task-meta"><span className={`status-pill ${task.tone}`}>{task.status}</span><span>{task.owner}</span><span>·</span><span>{task.time}</span></div></div><button className="row-arrow" aria-label={`Open item ${index + 1}`}><ArrowUpRight size={17}/></button></article>)}</div></div>
            <div className="panel-card sources-panel"><SectionTitle eyebrow="FRESH PERSPECTIVES" title="Discover topics" action="Open discovery"/><div className="panel-subtitle">Relevant stories from your selected sources.</div><div className="source-list">{sources.map(source => <article className="source-row" key={source.name}><div className="source-logo">{source.name.slice(0,1)}</div><div className="source-main"><strong>{source.name}</strong><span>{source.topic}</span><small>{source.time}</small></div><div className="relevance"><strong>{source.score}</strong><span>relevance</span></div></article>)}</div><button className="secondary-button"><Filter size={15}/> Refine topics</button></div>
          </section>

          <section className="bottom-grid"><div className="panel-card quick-panel"><SectionTitle eyebrow="START WITH AN IDEA" title="Quick actions"/><div className="quick-actions"><button><div className="quick-icon purple"><WandSparkles size={18}/></div><span><strong>Generate a draft</strong><small>Turn a brief into platform-ready content</small></span><ArrowUpRight size={16}/></button><button><div className="quick-icon blue"><Rss size={18}/></div><span><strong>Add content sources</strong><small>Connect blogs, RSS feeds and news</small></span><ArrowUpRight size={16}/></button><button><div className="quick-icon green"><Users size={18}/></div><span><strong>Invite your team</strong><small>Bring reviewers into your workflow</small></span><ArrowUpRight size={16}/></button></div></div><div className="panel-card workflow-panel"><SectionTitle eyebrow="BUILT AROUND PEOPLE" title="Your content workflow"/><div className="workflow-steps"><div className="workflow-step done"><div className="step-node"><CheckCheck size={13}/></div><div><strong>Discover</strong><span>Find relevant topics</span></div></div><div className="workflow-step done"><div className="step-node"><CheckCheck size={13}/></div><div><strong>Create</strong><span>Generate a first draft</span></div></div><div className="workflow-step current"><div className="step-node"><MessageSquare size={13}/></div><div><strong>Review</strong><span>Human edits and approval</span></div></div><div className="workflow-step"><div className="step-node"><CalendarDays size={13}/></div><div><strong>Publish</strong><span>Schedule approved content</span></div></div></div></div></section>
          <footer className="page-footer"><span>Marketing Studio <span>·</span> Built for thoughtful content operations</span><span><CircleAlert size={13}/> Preview dashboard · Sample data</span></footer>
        </div>
      </section>
    </main>
  );
}
