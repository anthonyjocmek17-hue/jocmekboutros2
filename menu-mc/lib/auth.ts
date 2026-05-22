import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyTableQrToken } from "@/lib/tableQrToken";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        tableToken: { label: "Table QR token", type: "text" }
      },
      async authorize(rawCredentials) {
        const raw = rawCredentials as Record<string, unknown> | undefined;
        const tableToken = typeof raw?.tableToken === "string" ? raw.tableToken.trim() : "";
        if (tableToken) {
          const payload = verifyTableQrToken(tableToken);
          if (!payload) return null;
          const table = await db.table.findFirst({ where: { label: payload.l } });
          if (!table) return null;
          const user = await db.user.findFirst({
            where: { role: "TABLE", tableId: table.id },
          });
          if (!user) return null;
          return { id: user.id, email: user.email, role: user.role, tableId: user.tableId } as any;
        }

        const parsed = CredentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        if (!user) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, role: user.role, tableId: user.tableId } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as any).id;
        token.role = (user as any).role;
        token.tableId = (user as any).tableId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).userId = token.userId;
      (session as any).role = token.role;
      (session as any).tableId = token.tableId;
      return session;
    }
  },
  pages: {
    signIn: "/login"
  }
};

