import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Brewable</h1>
      <p className="text-muted-foreground text-lg">
        Match your Brewfather inventory against your saved recipes and see what
        you can brew right now.
      </p>
      <Button asChild size="lg">
        <Link href="/dashboard">Open the dashboard</Link>
      </Button>
      <p className="text-muted-foreground text-sm">
        The dashboard arrives in a later task. Set BF_USER_ID and BF_API_KEY in
        your .env to connect your account.
      </p>
    </main>
  );
}
