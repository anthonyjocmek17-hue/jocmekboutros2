"use client";

import { deleteUser } from "./actions";

export function DeleteAccountButton({ userId }: { userId: string }) {
  return (
    <form
      action={deleteUser}
      onSubmit={(e) => {
        if (
          !confirm(
            "Delete this account permanently? Any orders owned by this user will be removed from the database (cascade)."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className="ui-btn border border-red-500/30 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-100 dark:hover:bg-red-950/70"
      >
        Delete
      </button>
    </form>
  );
}
