import { FormEvent, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import clsx from "clsx";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import type { ListWithCards } from "../lib/types";
import { CardTile } from "./CardTile";
import { Button } from "./ui";

export function BoardColumn({
  list,
  onAddCard,
  onRenameList,
  onDeleteList,
  onOpenCard,
  matchingCardIds,
}: {
  list: ListWithCards;
  onAddCard: (listId: string, title: string) => void;
  onRenameList: (listId: string, title: string) => void;
  onDeleteList: (listId: string) => void;
  onOpenCard: (cardId: string) => void;
  matchingCardIds: Set<string> | null;
}) {
  const visibleCards = matchingCardIds
    ? list.cards.filter((c) => matchingCardIds.has(c.id))
    : list.cards;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: "list" },
  });
  const { setNodeRef: setDropRef } = useDroppable({ id: list.id, data: { type: "list" } });

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(list.title);

  function submitCard(e: FormEvent) {
    e.preventDefault();
    const t = newTitle.trim();
    if (t) onAddCard(list.id, t);
    setNewTitle("");
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(
        "flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-slate-200/70 dark:bg-slate-800/70",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-center gap-1 px-2 py-2">
        <button
          className="cursor-grab touch-none rounded p-1 text-slate-400 hover:bg-slate-300/60 active:cursor-grabbing dark:hover:bg-slate-700/60"
          {...attributes}
          {...listeners}
          aria-label="Drag list"
        >
          <GripVertical size={16} />
        </button>
        {editingName ? (
          <form
            className="flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              const t = name.trim();
              if (t && t !== list.title) onRenameList(list.id, t);
              setEditingName(false);
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                setEditingName(false);
                setName(list.title);
              }}
              className="w-full rounded border border-brand-500 bg-white px-1.5 py-0.5 text-sm font-semibold dark:bg-slate-900 dark:text-slate-100"
            />
          </form>
        ) : (
          <button
            className="flex-1 truncate rounded px-1 py-0.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-300/50 dark:text-slate-200 dark:hover:bg-slate-700/50"
            onClick={() => {
              setName(list.title);
              setEditingName(true);
            }}
          >
            {list.title}
          </button>
        )}
        <span className="rounded bg-slate-300/70 px-1.5 text-xs text-slate-600 dark:bg-slate-700/70 dark:text-slate-300">
          {matchingCardIds ? `${visibleCards.length}/${list.cards.length}` : list.cards.length}
        </span>
        <button
          className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400"
          title="Delete list"
          onClick={() => {
            if (confirm(`Delete list "${list.title}" and its cards?`)) onDeleteList(list.id);
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div
        ref={setDropRef}
        className="scrollbar-thin flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
      >
        <SortableContext items={list.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {visibleCards.map((card) => (
            <CardTile key={card.id} card={card} onOpen={() => onOpenCard(card.id)} />
          ))}
        </SortableContext>
        {visibleCards.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 px-2 py-3 text-center text-xs text-slate-400 dark:border-slate-600 dark:text-slate-500">
            {matchingCardIds ? "No matching cards" : "Drop cards here"}
          </p>
        )}
      </div>

      <div className="p-2 pt-0">
        {adding ? (
          <form onSubmit={submitCard} className="space-y-2">
            <textarea
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitCard(e);
                }
              }}
              placeholder="Card title…"
              className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              rows={2}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" type="submit">
                Add card
              </Button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewTitle("");
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-300/50 dark:hover:bg-slate-700/50"
              >
                <X size={16} />
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-300/50 dark:text-slate-400 dark:hover:bg-slate-700/50"
          >
            <Plus size={16} /> Add a card
          </button>
        )}
      </div>
    </div>
  );
}
