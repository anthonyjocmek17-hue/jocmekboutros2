import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user?: {
      email?: string | null;
    };
    userId?: string;
    role?: string;
    tableId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    tableId?: string | null;
  }
}

