import { ChatSidebar } from "@/components/chat-sidebar";
import { HomeLink } from "@/components/home-link";
import { getCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/auth";

/**
 * Persistent layout for all authenticated app routes — see component
 * for the full rationale (route-group keeps the chat sidebar mounted
 * across page navigations).
 */
export default async function AuthedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const company = getCompany();
  return (
    <div className="flex h-screen bg-background text-foreground">
      <ChatSidebar
        userName={user?.name ?? "Guest"}
        companyName={company.name}
      />
      <main className="flex-1 overflow-y-auto relative">
        <HomeLink />
        {children}
      </main>
    </div>
  );
}
