import Link from "next/link";

const links = [
  ["Overview", "/"],
  ["Sources", "/sources"],
  ["Discover", "/discover"],
  ["Content studio", "/studio"],
  ["Review", "/review"],
  ["Publishing", "/calendar"],
  ["Brand settings", "/settings"],
];

export function AppNav() {
  return (
    <nav className="workspace-nav">
      <Link href="/" className="workspace-wordmark">✦ Marketing Studio</Link>
      <div>{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>
      <Link href="/api/auth/signout">Sign out</Link>
    </nav>
  );
}
