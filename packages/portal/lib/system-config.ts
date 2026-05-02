import type { SystemName } from "@hr-agent/shared";

export interface ColumnDef {
  key: string;
  label: string;
  /** Tailwind width classes, e.g. "w-32" */
  width?: string;
  /** Pre-built renderers for common cell shapes */
  kind?: "ticket-id" | "text" | "candidate" | "status" | "list" | "code" | "relative-time" | "value-set";
  className?: string;
}

export interface DetailField {
  key: string;
  label: string;
  kind?: "text" | "list" | "code" | "email";
}

export interface SystemConfig {
  slug: SystemName;
  label: string;
  /** Icon key matched in icon-map.tsx */
  icon: string;
  description: string;
  /** Two-letter color tone for the brand stripe */
  toneFrom: string; // tailwind text class e.g. "from-blue-500/30"
  toneTo: string;   // tailwind text class e.g. "to-cyan-500/10"
  /** Ticket-id prefix shown in the page subtitle */
  prefix: string;
  /** Columns shown in the list table */
  columns: ColumnDef[];
  /** Fields shown in the detail drawer (in order) */
  detailFields: DetailField[];
  /** Stat cards configuration */
  stats: { label: string; key: "total" | "done" | "in_progress" | "pending" | "errors" }[];
}

const COMMON_STATS: SystemConfig["stats"] = [
  { label: "Total tickets", key: "total" },
  { label: "Resolved", key: "done" },
  { label: "In progress", key: "in_progress" },
  { label: "Pending", key: "pending" },
];

export const SYSTEM_CONFIG: Record<SystemName, SystemConfig> = {
  hrms: {
    slug: "hrms",
    label: "HRMS",
    icon: "briefcase",
    description: "Employee master records · Department + designation + joining details",
    toneFrom: "from-blue-500/40",
    toneTo: "to-indigo-500/10",
    prefix: "EMP",
    columns: [
      { key: "ticket_id", label: "Employee ID", kind: "ticket-id", width: "w-40" },
      { key: "candidate_id", label: "Employee", kind: "candidate" },
      { key: "designation", label: "Designation", kind: "text" },
      { key: "department", label: "Department", kind: "text" },
      { key: "joining_date", label: "Joining", kind: "text", width: "w-32" },
      { key: "status", label: "Status", kind: "status", width: "w-32" },
    ],
    detailFields: [
      { key: "ticket_id", label: "Employee ID", kind: "code" },
      { key: "designation", label: "Designation" },
      { key: "department", label: "Department" },
      { key: "joining_date", label: "Joining date" },
      { key: "status", label: "Status" },
      { key: "artifact_summary", label: "Summary" },
    ],
    stats: COMMON_STATS,
  },
  documents: {
    slug: "documents",
    label: "Document Collection",
    icon: "file-text",
    description: "Background-verification document upload requests",
    toneFrom: "from-amber-500/40",
    toneTo: "to-orange-500/10",
    prefix: "DOC",
    columns: [
      { key: "ticket_id", label: "Request ID", kind: "ticket-id", width: "w-40" },
      { key: "candidate_id", label: "Candidate", kind: "candidate" },
      { key: "candidate_email", label: "Sent to", kind: "text" },
      { key: "documents", label: "Checklist", kind: "list" },
      { key: "status", label: "Status", kind: "status", width: "w-32" },
    ],
    detailFields: [
      { key: "ticket_id", label: "Request ID", kind: "code" },
      { key: "candidate_email", label: "Recipient", kind: "email" },
      { key: "documents", label: "Documents requested", kind: "list" },
      { key: "status", label: "Status" },
      { key: "artifact_summary", label: "Summary" },
    ],
    stats: COMMON_STATS,
  },
  buddy: {
    slug: "buddy",
    label: "Buddy Assignment",
    icon: "user-check",
    description: "Onboarding buddy match — peer who guides the new joiner",
    toneFrom: "from-emerald-500/40",
    toneTo: "to-teal-500/10",
    prefix: "BUD",
    columns: [
      { key: "ticket_id", label: "Match ID", kind: "ticket-id", width: "w-40" },
      { key: "candidate_id", label: "Candidate", kind: "candidate" },
      { key: "buddy_name", label: "Buddy", kind: "text" },
      { key: "buddy_email", label: "Buddy email", kind: "text" },
      { key: "team", label: "Team", kind: "text" },
      { key: "status", label: "Status", kind: "status", width: "w-32" },
    ],
    detailFields: [
      { key: "ticket_id", label: "Match ID", kind: "code" },
      { key: "buddy_name", label: "Buddy" },
      { key: "buddy_email", label: "Buddy email", kind: "email" },
      { key: "team", label: "Team" },
      { key: "selection_reason", label: "Selection reason" },
      { key: "status", label: "Status" },
    ],
    stats: COMMON_STATS,
  },
  it: {
    slug: "it",
    label: "IT Asset Tickets",
    icon: "laptop",
    description: "Laptop allocation and dispatch tracking",
    toneFrom: "from-slate-400/40",
    toneTo: "to-slate-500/10",
    prefix: "IT",
    columns: [
      { key: "ticket_id", label: "Ticket #", kind: "ticket-id", width: "w-32" },
      { key: "candidate_id", label: "Requester", kind: "candidate" },
      { key: "laptop_model", label: "Model", kind: "text" },
      { key: "ram", label: "RAM", kind: "text", width: "w-20" },
      { key: "cpu", label: "CPU", kind: "text" },
      { key: "status", label: "Shipping", kind: "status", width: "w-32" },
    ],
    detailFields: [
      { key: "ticket_id", label: "Ticket #", kind: "code" },
      { key: "laptop_model", label: "Model" },
      { key: "ram", label: "RAM" },
      { key: "cpu", label: "CPU" },
      { key: "accessories", label: "Accessories", kind: "list" },
      { key: "status", label: "Shipping status" },
    ],
    stats: COMMON_STATS,
  },
  software: {
    slug: "software",
    label: "Software Provisioning",
    icon: "boxes",
    description: "Per-role software entitlements and license requests",
    toneFrom: "from-violet-500/40",
    toneTo: "to-purple-500/10",
    prefix: "SW",
    columns: [
      { key: "ticket_id", label: "Request #", kind: "ticket-id", width: "w-32" },
      { key: "candidate_id", label: "Requester", kind: "candidate" },
      { key: "role_id", label: "Role", kind: "text" },
      { key: "entitlements", label: "Entitlements", kind: "value-set" },
      { key: "status", label: "Status", kind: "status", width: "w-32" },
    ],
    detailFields: [
      { key: "ticket_id", label: "Request #", kind: "code" },
      { key: "role_id", label: "Role" },
      { key: "entitlements", label: "Entitlements", kind: "list" },
      { key: "status", label: "Status" },
    ],
    stats: COMMON_STATS,
  },
  training: {
    slug: "training",
    label: "Training Enrollments",
    icon: "graduation-cap",
    description: "Required and recommended courses by role family",
    toneFrom: "from-pink-500/40",
    toneTo: "to-rose-500/10",
    prefix: "TR",
    columns: [
      { key: "ticket_id", label: "Enrollment", kind: "ticket-id", width: "w-32" },
      { key: "candidate_id", label: "Trainee", kind: "candidate" },
      { key: "required", label: "Required", kind: "value-set" },
      { key: "recommended", label: "Recommended", kind: "value-set" },
      { key: "status", label: "Status", kind: "status", width: "w-32" },
    ],
    detailFields: [
      { key: "ticket_id", label: "Enrollment", kind: "code" },
      { key: "required", label: "Required", kind: "list" },
      { key: "recommended", label: "Recommended", kind: "list" },
      { key: "status", label: "Status" },
    ],
    stats: COMMON_STATS,
  },
  welcome: {
    slug: "welcome",
    label: "Welcome Notifications",
    icon: "mail",
    description: "Pre-arrival welcome emails sent through ACS",
    toneFrom: "from-cyan-500/40",
    toneTo: "to-sky-500/10",
    prefix: "WEL",
    columns: [
      { key: "ticket_id", label: "Message", kind: "ticket-id", width: "w-40" },
      { key: "candidate_id", label: "Recipient", kind: "candidate" },
      { key: "recipients", label: "Sent to", kind: "text" },
      { key: "subject", label: "Subject", kind: "text" },
      { key: "status", label: "Delivery", kind: "status", width: "w-32" },
    ],
    detailFields: [
      { key: "ticket_id", label: "Message", kind: "code" },
      { key: "recipients", label: "Recipient(s)" },
      { key: "subject", label: "Subject" },
      { key: "sent_at", label: "Sent at" },
      { key: "message_id", label: "Provider ID", kind: "code" },
      { key: "status", label: "Delivery status" },
    ],
    stats: COMMON_STATS,
  },
  idcard: {
    slug: "idcard",
    label: "ID Card Requests",
    icon: "id-card",
    description: "Photo session + physical card issuance",
    toneFrom: "from-yellow-500/40",
    toneTo: "to-amber-500/10",
    prefix: "ID",
    columns: [
      { key: "ticket_id", label: "Request ID", kind: "ticket-id", width: "w-40" },
      { key: "candidate_id", label: "Candidate", kind: "candidate" },
      { key: "type", label: "Type", kind: "text" },
      { key: "photo_status", label: "Photo", kind: "text" },
      { key: "card_status", label: "Card", kind: "text" },
      { key: "status", label: "Status", kind: "status", width: "w-32" },
    ],
    detailFields: [
      { key: "ticket_id", label: "Request ID", kind: "code" },
      { key: "type", label: "Card type" },
      { key: "photo_status", label: "Photo session" },
      { key: "card_status", label: "Physical card" },
      { key: "status", label: "Status" },
    ],
    stats: COMMON_STATS,
  },
  payroll: {
    slug: "payroll",
    label: "Payroll Setup",
    icon: "circle-dollar",
    description: "Salary band + bank/PF registration",
    toneFrom: "from-green-500/40",
    toneTo: "to-emerald-500/10",
    prefix: "PAY",
    columns: [
      { key: "ticket_id", label: "Setup ID", kind: "ticket-id", width: "w-40" },
      { key: "candidate_id", label: "Employee", kind: "candidate" },
      { key: "band", label: "Band", kind: "text", width: "w-24" },
      { key: "bank_status", label: "Bank", kind: "text" },
      { key: "pf_status", label: "PF", kind: "text" },
      { key: "status", label: "Status", kind: "status", width: "w-32" },
    ],
    detailFields: [
      { key: "ticket_id", label: "Setup ID", kind: "code" },
      { key: "band", label: "Salary band" },
      { key: "bank_status", label: "Bank registration" },
      { key: "pf_status", label: "PF" },
      { key: "status", label: "Status" },
    ],
    stats: COMMON_STATS,
  },
  manager_notify: {
    slug: "manager_notify",
    label: "Manager Notifications",
    icon: "send",
    description: "Briefing email sent to the hiring manager",
    toneFrom: "from-fuchsia-500/40",
    toneTo: "to-pink-500/10",
    prefix: "MGR",
    columns: [
      { key: "ticket_id", label: "Notify ID", kind: "ticket-id", width: "w-40" },
      { key: "candidate_id", label: "About", kind: "candidate" },
      { key: "manager_name", label: "Manager", kind: "text" },
      { key: "manager_email", label: "Email", kind: "text" },
      { key: "channel", label: "Channel", kind: "text" },
      { key: "status", label: "Status", kind: "status", width: "w-32" },
    ],
    detailFields: [
      { key: "ticket_id", label: "Notify ID", kind: "code" },
      { key: "manager_name", label: "Manager" },
      { key: "manager_email", label: "Manager email", kind: "email" },
      { key: "channel", label: "Channel" },
      { key: "sent_at", label: "Sent at" },
      { key: "status", label: "Status" },
    ],
    stats: COMMON_STATS,
  },
  seating: {
    slug: "seating",
    label: "Seating Allocation",
    icon: "armchair",
    description: "Floor + wing + desk assignment",
    toneFrom: "from-teal-500/40",
    toneTo: "to-cyan-500/10",
    prefix: "SEAT",
    columns: [
      { key: "ticket_id", label: "Allocation", kind: "ticket-id", width: "w-32" },
      { key: "candidate_id", label: "Employee", kind: "candidate" },
      { key: "floor", label: "Floor", kind: "text", width: "w-20" },
      { key: "wing", label: "Wing", kind: "text" },
      { key: "desk_code", label: "Desk", kind: "code" },
      { key: "status", label: "Status", kind: "status", width: "w-32" },
    ],
    detailFields: [
      { key: "ticket_id", label: "Allocation", kind: "code" },
      { key: "floor", label: "Floor" },
      { key: "wing", label: "Wing" },
      { key: "desk_code", label: "Desk", kind: "code" },
      { key: "status", label: "Status" },
    ],
    stats: COMMON_STATS,
  },
  parking: {
    slug: "parking",
    label: "Parking Allocation",
    icon: "car",
    description: "Parking slot per role + team eligibility",
    toneFrom: "from-zinc-400/40",
    toneTo: "to-slate-400/10",
    prefix: "PARK",
    columns: [
      { key: "ticket_id", label: "Allocation", kind: "ticket-id", width: "w-32" },
      { key: "candidate_id", label: "Employee", kind: "candidate" },
      { key: "slot", label: "Slot", kind: "code" },
      { key: "vehicle_type", label: "Vehicle", kind: "text" },
      { key: "status", label: "Status", kind: "status", width: "w-32" },
    ],
    detailFields: [
      { key: "ticket_id", label: "Allocation", kind: "code" },
      { key: "slot", label: "Slot", kind: "code" },
      { key: "vehicle_type", label: "Vehicle type" },
      { key: "status", label: "Status" },
    ],
    stats: COMMON_STATS,
  },
};
