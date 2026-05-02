import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  Users,
  Briefcase,
  FileText,
  UserCheck,
  Laptop,
  Boxes,
  GraduationCap,
  Mail,
  IdCard,
  CircleDollarSign,
  Send,
  Armchair,
  Car,
  LayoutDashboard,
  Settings,
  Database,
} from "lucide-react";

const SYSTEMS = [
  { href: "/systems/hrms", label: "HRMS", icon: Briefcase, desc: "Employee records" },
  { href: "/systems/documents", label: "Documents", icon: FileText, desc: "Doc collection" },
  { href: "/systems/buddy", label: "Buddy", icon: UserCheck, desc: "Buddy assignments" },
  { href: "/systems/it", label: "IT Asset", icon: Laptop, desc: "Laptop tickets" },
  { href: "/systems/software", label: "Software", icon: Boxes, desc: "Software entitlements" },
  { href: "/systems/training", label: "Training", icon: GraduationCap, desc: "Course enrollments" },
  { href: "/systems/welcome", label: "Welcome", icon: Mail, desc: "Welcome notifications" },
  { href: "/systems/idcard", label: "ID Card", icon: IdCard, desc: "ID card requests" },
  { href: "/systems/payroll", label: "Payroll", icon: CircleDollarSign, desc: "Payroll setup" },
  { href: "/systems/manager_notify", label: "Manager Notify", icon: Send, desc: "Manager notifications" },
  { href: "/systems/seating", label: "Seating", icon: Armchair, desc: "Desk allocations" },
  { href: "/systems/parking", label: "Parking", icon: Car, desc: "Parking allocations" },
];

const ADMIN = [
  { href: "/admin", label: "Admin Dashboard", icon: LayoutDashboard, desc: "Big-number metrics + recent activity" },
  { href: "/admin/master-data", label: "Master Data", icon: Database, desc: "Roles, software matrix, training, teams" },
  { href: "/admin/settings", label: "Settings", icon: Settings, desc: "Demo email override + safety toggles" },
];

export default function Home() {
  return (
    <AppShell>
      <div className="p-8 space-y-10">
        <div>
          <h1 className="text-3xl font-semibold">HR Onboarding Portal</h1>
          <p className="text-muted-foreground mt-1">
            Talk to the agent in the chat sidebar, or jump straight to any section below.
          </p>
        </div>

        <Section title="Candidates">
          <Card
            href="/candidates"
            icon={Users}
            label="All candidates"
            desc="Onboarding pipeline — click any row for the live cascade view"
            featured
          />
        </Section>

        <Section title="Systems" subtitle="One CRUD page per mock back-office system">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {SYSTEMS.map((s) => (
              <Card key={s.href} {...s} />
            ))}
          </div>
        </Section>

        <Section title="Admin">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ADMIN.map((a) => (
              <Card key={a.href} {...a} />
            ))}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Card({
  href,
  label,
  desc,
  icon: Icon,
  featured,
}: {
  href: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-lg border p-4 hover:border-input hover:bg-card transition-colors block ${
        featured
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border bg-card/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={`size-5 mt-0.5 shrink-0 ${
            featured ? "text-amber-400" : "text-muted-foreground group-hover:text-foreground"
          }`}
        />
        <div className="min-w-0">
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
