import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { CalendarClock, CheckSquare, MessageSquare } from "lucide-react";
import type { CardSummary } from "../lib/types";
import { Avatar } from "./ui";
import { dueInfo } from "../lib/format";

const DUE_TONE: Record<string, string> = {
  overdue: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  today: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  soon: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  normal: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export function CardCardContent({ card }: { card: CardSummary }) {
  const due = card.dueDate ? dueInfo(card.dueDate) : null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      {card.labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {card.labels.map((l) => (
            <span
              key={l.id}
              className="h-2 w-8 rounded-full"
              style={{ background: l.color }}
              title={l.name}
            />
          ))}
        </div>
      )}
      <p className="text-sm text-slate-800 dark:text-slate-100">{card.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {due && (
          <span className={clsx("flex items-center gap-1 rounded px-1.5 py-0.5", DUE_TONE[due.tone])}>
            <CalendarClock size={12} /> {due.label}
          </span>
        )}
        {card.checklist.total > 0 && (
          <span className="flex items-center gap-1">
            <CheckSquare size={12} /> {card.checklist.done}/{card.checklist.total}
          </span>
        )}
        {card.commentCount > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare size={12} /> {card.commentCount}
          </span>
        )}
        {card.description && <span title="Has a description">≡</span>}
        {card.assignees.length > 0 && (
          <span className="ml-auto flex -space-x-1.5">
            {card.assignees.slice(0, 3).map((a) => (
              <Avatar key={a.id} name={a.name} color={a.avatarColor} size={20} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

export function CardTile({ card, onOpen }: { card: CardSummary; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", listId: card.listId },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={clsx("cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <CardCardContent card={card} />
    </div>
  );
}
