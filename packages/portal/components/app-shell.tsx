import { ChatSidebar } from "./chat-sidebar";
import { getCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/auth";

export async function AppShell({ children }: { children: React.ReactNode }) {
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
