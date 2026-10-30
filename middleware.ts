import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/",
    "/sources/:path*",
    "/discover/:path*",
    "/studio/:path*",
    "/review/:path*",
    "/calendar/:path*",
    "/settings/:path*",
    "/team/:path*",
  ],
};
