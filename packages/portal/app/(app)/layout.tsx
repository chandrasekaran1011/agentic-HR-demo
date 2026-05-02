import { ChatSidebar } from "@/components/chat-sidebar";
import { getCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/auth";

/**
 * Layout for all authenticated app routes.
 *
 * Lives in a Next.js route group "(app)" so this layout persists across
 * navigations between /, /candidates, /systems/*, /admin/*. The chat
 * sidebar component therefore does NOT remount when you click a link —
 * the SSE connection, voice WebRTC, transcript, and streaming responses
 * all stay alive.
 *
 * /login is outside this group and renders without the sidebar.
 */
export default async function AuthedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const company = getCompany();
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <ChatSidebar
        userName={user?.name ?? "Guest"}
        companyName={company.name}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
