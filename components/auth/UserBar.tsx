import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

/** Server component: shows the signed-in user's email + a sign-out button. */
export async function UserBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <div className="flex items-center justify-end gap-3 border-b p-3 text-sm">
      <span className="text-muted-foreground">{user.email}</span>
      <form action={signOut}>
        <button className="rounded-md border border-input px-3 py-1 font-medium">
          Sign out
        </button>
      </form>
    </div>
  );
}
