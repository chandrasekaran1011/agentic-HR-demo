/**
 * AppShell is now a passthrough.
 *
 * Originally wrapped each page with the chat sidebar + flex container,
 * which caused the chat to remount on every navigation (killing SSE,
 * voice WebRTC, etc.). The shell now lives in app/(app)/layout.tsx so it
 * persists across routes. This passthrough is kept so pages don't need
 * editing — they import { AppShell } and it just renders children.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
