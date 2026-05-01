"use client";

import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatSidebarProps {
  userName: string;
  companyName: string;
}

export function ChatSidebar({ userName, companyName }: ChatSidebarProps) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className="w-[30%] min-w-[400px] max-w-[640px] bg-slate-900 border-r border-slate-800 flex flex-col h-screen">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-lg font-semibold">{companyName}</h1>
        <p className="text-xs text-slate-400">HR Onboarding Agent</p>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        <p className="text-sm text-slate-500 italic">Voice agent activates in Phase 3.</p>
      </div>
      <div className="p-6 border-t border-slate-800">
        <Button
          disabled
          className="w-full h-16 rounded-full"
          title="Voice integration arrives in Phase 3"
        >
          <Mic className="size-6" />
        </Button>
        <p className="text-xs text-center text-slate-500 mt-2">Idle</p>
        <div className="flex justify-between items-center mt-4 text-xs text-slate-400">
          <span>{userName}</span>
          <button
            onClick={logout}
            className="hover:text-slate-200 underline-offset-2 hover:underline"
          >
            logout
          </button>
        </div>
      </div>
    </aside>
  );
}
