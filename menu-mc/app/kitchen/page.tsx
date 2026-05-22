import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { KitchenClient } from "./ui/KitchenClient";

export default async function KitchenPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session as any).role as string;
  if (role !== "KITCHEN" && role !== "ADMIN") redirect("/");

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <h1 className="menu-title text-xs font-semibold text-accent">Kitchen screen</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-slate-200/70">
          Incoming orders appear here. This is meant for a kitchen device.
        </p>
      </div>
      <KitchenClient />
    </div>
  );
}

