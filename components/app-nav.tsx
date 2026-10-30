import Link from "next/link";
import { signOut } from "next-auth/react";

const links = [
  ["Overview", "/"],
  ["Sources", "/sources"],
  ["Discover", "/discover"],
  ["Content studio", "/studio"],
  ["Review", "/review"],
  ["Publishing", "/calendar"],
  ["Brand settings", "/settings"],
  ["Team", "/team"],
];

export function AppNav() {
  return (
    <nav className="workspace-nav">
      <Link href="/" className="workspace-wordmark">✦ Marketing Studio</Link>
      <div>{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>
      <button className="signout-link" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
    </nav>
  );
}
