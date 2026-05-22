import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    const token = (req as any).nextauth?.token as any;
    const role = token?.role as string | undefined;

    const path = req.nextUrl.pathname;

    if (path.startsWith("/admin")) {
      if (role !== "ADMIN") return Response.redirect(new URL("/", req.url));
    }
    if (path.startsWith("/kitchen")) {
      if (role !== "KITCHEN" && role !== "ADMIN") return Response.redirect(new URL("/", req.url));
    }
    if (path.startsWith("/waiter")) {
      if (role !== "WAITER" && role !== "ADMIN") return Response.redirect(new URL("/", req.url));
    }
    return;
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    }
  }
);

export const config = {
  matcher: ["/admin/:path*", "/kitchen/:path*", "/waiter/:path*"]
};

