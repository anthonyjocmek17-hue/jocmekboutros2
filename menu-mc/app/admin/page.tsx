import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AdminHome() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [categoryCount, itemCount, orderCount, voucherCount, userCount] = await Promise.all([
    db.category.count(),
    db.menuItem.count(),
    db.order.count(),
    db.voucher.count(),
    db.user.count()
  ]);

  return (
    <div className="space-y-6">
      <div className="ui-card p-6">
        <h1 className="menu-title text-xs font-semibold text-accent">Admin</h1>
        <p className="mt-2 text-sm text-black/70 dark:text-slate-100/80">
          You’re signed in as <span className="font-medium">{session.user?.email}</span>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="ui-btn px-3 py-2 text-sm dark:bg-slate-900/50 dark:hover:bg-slate-900/70" href="/admin/categories">
            Categories ({categoryCount})
          </Link>
          <Link className="ui-btn px-3 py-2 text-sm dark:bg-slate-900/50 dark:hover:bg-slate-900/70" href="/admin/items">
            Menu items ({itemCount})
          </Link>
          <Link className="ui-btn px-3 py-2 text-sm dark:bg-slate-900/50 dark:hover:bg-slate-900/70" href="/admin/orders">
            Orders ({orderCount})
          </Link>
          <Link className="ui-btn px-3 py-2 text-sm dark:bg-slate-900/50 dark:hover:bg-slate-900/70" href="/admin/vouchers">
            Vouchers ({voucherCount})
          </Link>
          <Link className="ui-btn px-3 py-2 text-sm dark:bg-slate-900/50 dark:hover:bg-slate-900/70" href="/admin/qr/table-1">
            Table 1 QR
          </Link>
          <Link className="ui-btn px-3 py-2 text-sm dark:bg-slate-900/50 dark:hover:bg-slate-900/70" href="/admin/users">
            Accounts ({userCount})
          </Link>
        </div>
      </div>
    </div>
  );
}

