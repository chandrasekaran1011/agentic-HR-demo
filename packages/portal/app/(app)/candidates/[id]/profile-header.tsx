import type { Candidate } from "@hr-agent/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function ProfileHeader({ candidate }: { candidate: Candidate }) {
  const initials = candidate.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold">{candidate.name}</h1>
          <p className="text-slate-400">
            {candidate.role} · {candidate.team} · {candidate.manager}
          </p>
          <p className="text-sm text-slate-500">Joining {candidate.joining_date}</p>
        </div>
      </div>
      <Badge className="text-sm">{candidate.status.replace("_", " ")}</Badge>
    </div>
  );
}
