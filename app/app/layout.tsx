import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { WorkspaceGate } from "@/components/app/workspace";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <WorkspaceGate>
      <AppShell>{children}</AppShell>
    </WorkspaceGate>
  );
}
