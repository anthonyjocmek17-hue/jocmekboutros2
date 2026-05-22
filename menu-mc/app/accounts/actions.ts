"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function isNextRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthorized");
  if ((session as { role?: string }).role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

const RoleEnum = z.enum(["ADMIN", "KITCHEN", "WAITER", "TABLE"]);

const CreateUserSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  role: RoleEnum,
  tableId: z.string().optional().or(z.literal(""))
});

export async function createUser(formData: FormData) {
  try {
    await requireAdmin();
    const parsed = CreateUserSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role"),
      tableId: formData.get("tableId") ?? ""
    });
    if (!parsed.success) throw new Error("Invalid input: check email, password (min 8), and role.");

    let tableId: string | null = parsed.data.tableId?.trim() || null;
    if (parsed.data.role === "TABLE") {
      if (!tableId) throw new Error("Table logins must be assigned to a physical table.");
      const t = await db.table.findUnique({ where: { id: tableId } });
      if (!t) throw new Error("Selected table does not exist.");
    } else {
      tableId = null;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const email = parsed.data.email.trim().toLowerCase();

    try {
      await db.user.create({
        data: {
          email,
          passwordHash,
          role: parsed.data.role,
          tableId
        }
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Unique") || msg.includes("unique")) throw new Error("An account with this email already exists.");
      throw e;
    }

    revalidatePath("/accounts");
  } catch (e: unknown) {
    if (isNextRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Could not create account.";
    redirect(`/accounts?err=${encodeURIComponent(msg)}`);
  }
  redirect("/accounts?created=1");
}

const UpdateUserSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email().max(254),
  role: RoleEnum,
  tableId: z.string().optional().or(z.literal("")),
  newPassword: z.string().max(128).optional().or(z.literal(""))
});

export async function updateUser(formData: FormData) {
  try {
    await requireAdmin();
    const parsed = UpdateUserSchema.safeParse({
      userId: formData.get("userId"),
      email: formData.get("email"),
      role: formData.get("role"),
      tableId: formData.get("tableId") ?? "",
      newPassword: formData.get("newPassword") ?? ""
    });
    if (!parsed.success) throw new Error("Invalid input.");

    const target = await db.user.findUnique({ where: { id: parsed.data.userId } });
    if (!target) throw new Error("Account not found.");

    if (target.role === "ADMIN" && parsed.data.role !== "ADMIN") {
      const adminCount = await db.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) throw new Error("Cannot change role: this is the only administrator account.");
    }

    let tableId: string | null = parsed.data.tableId?.trim() || null;
    if (parsed.data.role === "TABLE") {
      if (!tableId) throw new Error("Table logins must be assigned to a physical table.");
      const t = await db.table.findUnique({ where: { id: tableId } });
      if (!t) throw new Error("Selected table does not exist.");
    } else {
      tableId = null;
    }

    const email = parsed.data.email.trim().toLowerCase();
    const np = parsed.data.newPassword?.trim();

    if (np && np.length > 0 && np.length < 8) {
      throw new Error("New password must be at least 8 characters, or leave the field empty to keep the current password.");
    }

    const data: {
      email: string;
      role: string;
      tableId: string | null;
      passwordHash?: string;
    } = {
      email,
      role: parsed.data.role,
      tableId
    };

    if (np && np.length >= 8) {
      data.passwordHash = await bcrypt.hash(np, 12);
    }

    try {
      await db.user.update({ where: { id: parsed.data.userId }, data });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Unique") || msg.includes("unique")) throw new Error("That email is already used by another account.");
      throw e;
    }

    revalidatePath("/accounts");
  } catch (e: unknown) {
    if (isNextRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Could not update account.";
    redirect(`/accounts?err=${encodeURIComponent(msg)}`);
  }
  redirect("/accounts?updated=1");
}

export async function deleteUser(formData: FormData) {
  try {
    await requireAdmin();
    const session = await getServerSession(authOptions);
    const userId = String(formData.get("userId") ?? "").trim();
    if (!userId) throw new Error("Missing account.");

    const me = (session as { userId?: string }).userId;
    if (userId === me) throw new Error("You cannot delete the account you are currently signed in with.");

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error("Account not found.");

    if (target.role === "ADMIN") {
      const adminCount = await db.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) throw new Error("Cannot delete the only administrator account.");
    }

    await db.user.delete({ where: { id: userId } });
    revalidatePath("/accounts");
  } catch (e: unknown) {
    if (isNextRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : "Could not delete account.";
    redirect(`/accounts?err=${encodeURIComponent(msg)}`);
  }
  redirect("/accounts?deleted=1");
}
