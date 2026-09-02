import { Search, X } from "lucide-react";
import type { BoardDetail } from "../lib/types";
import { Avatar } from "./ui";

export interface Filters {
  q: string;
  labelId: string;
  assigneeId: string;
  due: "" | "overdue" | "today" | "week" | "none";
}

export const EMPTY_FILTERS: Filters = { q: "", labelId: "", assigneeId: "", due: "" };

export function isFiltering(f: Filters): boolean {
  return Boolean(f.q || f.labelId || f.assigneeId || f.due);
}

export function FilterBar({
  board,
  filters,
  onChange,
}: {
  board: BoardDetail;
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
        <input
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search cards…"
          className="w-48 rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      <select
        value={filters.labelId}
        onChange={(e) => set({ labelId: e.target.value })}
        className="rounded-md border border-slate-300 bg-white py-1.5 pl-2 pr-7 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        <option value="">Any label</option>
        {board.labels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      <select
        value={filters.assigneeId}
        onChange={(e) => set({ assigneeId: e.target.value })}
        className="rounded-md border border-slate-300 bg-white py-1.5 pl-2 pr-7 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        <option value="">Any assignee</option>
        {board.members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <select
        value={filters.due}
        onChange={(e) => set({ due: e.target.value as Filters["due"] })}
        className="rounded-md border border-slate-300 bg-white py-1.5 pl-2 pr-7 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        <option value="">Any due date</option>
        <option value="overdue">Overdue</option>
        <option value="today">Due today</option>
        <option value="week">Due this week</option>
        <option value="none">No due date</option>
      </select>

      {isFiltering(filters) && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <X size={14} /> Clear
        </button>
      )}

      <span className="ml-auto flex -space-x-1.5">
        {board.members.map((m) => (
          <Avatar key={m.id} name={m.name} color={m.avatarColor} size={24} title={`${m.name} (${m.role})`} />
        ))}
      </span>
    </div>
  );
}
