import { formatDistanceToNow, isPast, isToday, isTomorrow, format } from "date-fns";

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function relativeTime(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export interface DueInfo {
  label: string;
  tone: "overdue" | "today" | "soon" | "normal";
}

export function dueInfo(iso: string): DueInfo {
  const date = new Date(iso);
  if (isToday(date)) return { label: "Due today", tone: "today" };
  if (isPast(date)) return { label: `Overdue · ${format(date, "d MMM")}`, tone: "overdue" };
  if (isTomorrow(date)) return { label: "Due tomorrow", tone: "soon" };
  return { label: format(date, "d MMM"), tone: "normal" };
}

export function toDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

const ACTIVITY_TEXT: Record<string, (d: Record<string, unknown>) => string> = {
  "board.created": () => "created this board",
  "board.updated": () => "updated the board",
  "board.archived": () => "archived the board",
  "board.restored": () => "restored the board",
  "list.created": (d) => `added list "${d.title}"`,
  "list.updated": (d) => `updated list "${d.title}"`,
  "list.deleted": (d) => `deleted list "${d.title}"`,
  "card.created": (d) => `added card "${d.title}"`,
  "card.renamed": (d) => `renamed "${d.from}" to "${d.to}"`,
  "card.description.updated": () => "updated the description",
  "card.moved": (d) => `moved this card from ${d.from} to ${d.to}`,
  "card.archived": () => "archived this card",
  "card.restored": () => "restored this card",
  "card.deleted": (d) => `deleted card "${d.title}"`,
  "due.set": () => "set the due date",
  "due.cleared": () => "removed the due date",
  "label.added": (d) => `added the "${d.label}" label`,
  "label.removed": () => "removed a label",
  "assignee.added": (d) => `assigned ${d.assignee}`,
  "assignee.removed": () => "removed an assignee",
  "member.added": (d) => `added ${d.memberName} to the board`,
  "comment.added": () => "commented",
  "checklist.added": (d) => `added checklist "${d.title}"`,
  "checklist.item.completed": (d) => `checked off "${d.text}"`,
  "checklist.item.reopened": (d) => `unchecked "${d.text}"`,
};

export function activityText(type: string, data: Record<string, unknown>): string {
  const fn = ACTIVITY_TEXT[type];
  return fn ? fn(data) : type.replace(/[._]/g, " ");
}
