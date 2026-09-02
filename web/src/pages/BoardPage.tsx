import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Plus, Users } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import type { BoardDetail, CardSummary, ListWithCards } from "../lib/types";
import { Button, Spinner } from "../components/ui";
import { BoardColumn } from "../components/BoardColumn";
import { CardCardContent } from "../components/CardTile";
import { CardModal } from "../components/CardModal";
import { MembersModal } from "../components/MembersModal";
import { EMPTY_FILTERS, FilterBar, isFiltering } from "../components/FilterBar";
import type { Filters } from "../components/FilterBar";

export default function BoardPage() {
  const { boardId = "" } = useParams();
  const qc = useQueryClient();

  const boardQuery = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => (await api.get<{ board: BoardDetail }>(`/boards/${boardId}`)).data.board,
  });

  const [columns, setColumns] = useState<ListWithCards[]>([]);
  const [activeCard, setActiveCard] = useState<CardSummary | null>(null);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const draggingRef = useRef(false);
  const [error, setError] = useState("");

  // Keep local board state in sync with the server, except mid-drag.
  useEffect(() => {
    if (boardQuery.data && !draggingRef.current) {
      setColumns(boardQuery.data.lists);
    }
  }, [boardQuery.data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* ------------ search / filter ------------ */
  const filtering = isFiltering(filters);
  const searchQuery = useQuery({
    queryKey: ["search", boardId, filters],
    enabled: filtering,
    queryFn: async () => {
      const { data } = await api.get<{ results: { id: string }[] }>(`/boards/${boardId}/search`, {
        params: {
          q: filters.q || undefined,
          labelId: filters.labelId || undefined,
          assigneeId: filters.assigneeId || undefined,
          due: filters.due || undefined,
        },
      });
      return data.results;
    },
  });
  const matchingCardIds = useMemo(
    () => (filtering && searchQuery.data ? new Set(searchQuery.data.map((r) => r.id)) : null),
    [filtering, searchQuery.data],
  );

  /* ------------ mutations ------------ */
  const refetchBoard = () => qc.invalidateQueries({ queryKey: ["board", boardId] });
  const onErr = (e: unknown) => {
    setError(errorMessage(e));
    refetchBoard();
  };

  const addList = useMutation({
    mutationFn: (title: string) => api.post("/lists", { boardId, title }),
    onSuccess: refetchBoard,
    onError: onErr,
  });
  const renameList = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.patch(`/lists/${id}`, { title }),
    onSuccess: refetchBoard,
    onError: onErr,
  });
  const deleteList = useMutation({
    mutationFn: (id: string) => api.delete(`/lists/${id}`),
    onSuccess: refetchBoard,
    onError: onErr,
  });
  const addCard = useMutation({
    mutationFn: ({ listId, title }: { listId: string; title: string }) =>
      api.post("/cards", { listId, title }),
    onSuccess: refetchBoard,
    onError: onErr,
  });
  const reorderLists = useMutation({
    mutationFn: (orderedIds: string[]) => api.put("/lists/reorder", { boardId, orderedIds }),
    onError: onErr,
  });
  const moveCard = useMutation({
    mutationFn: ({ cardId, toListId, toIndex }: { cardId: string; toListId: string; toIndex: number }) =>
      api.post(`/cards/${cardId}/move`, { toListId, toIndex }),
    onSettled: refetchBoard,
    onError: onErr,
  });
  const patchBoard = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/boards/${boardId}`, body),
    onSuccess: refetchBoard,
    onError: onErr,
  });

  /* ------------ drag helpers ------------ */
  const findColumn = (id: string): ListWithCards | undefined => {
    if (columns.some((c) => c.id === id)) return columns.find((c) => c.id === id);
    return columns.find((c) => c.cards.some((card) => card.id === id));
  };

  function handleDragStart(e: DragStartEvent) {
    draggingRef.current = true;
    const { active } = e;
    if (active.data.current?.type === "list") {
      setActiveListId(String(active.id));
    } else {
      const col = findColumn(String(active.id));
      const card = col?.cards.find((c) => c.id === active.id) ?? null;
      setActiveCard(card);
    }
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || active.data.current?.type === "list") return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const activeCol = findColumn(activeId);
    const overCol = findColumn(overId);
    if (!activeCol || !overCol || activeCol.id === overCol.id) return;

    setColumns((cols) => {
      const activeItems = activeCol.cards;
      const overItems = overCol.cards;
      const activeIndex = activeItems.findIndex((c) => c.id === activeId);
      const overIndex = overItems.findIndex((c) => c.id === overId);
      const insertIndex = overIndex >= 0 ? overIndex : overItems.length;
      const moved = activeItems[activeIndex];
      if (!moved) return cols;

      return cols.map((col) => {
        if (col.id === activeCol.id) {
          return { ...col, cards: col.cards.filter((c) => c.id !== activeId) };
        }
        if (col.id === overCol.id) {
          const next = [...col.cards];
          next.splice(insertIndex, 0, { ...moved, listId: col.id });
          return { ...col, cards: next };
        }
        return col;
      });
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    draggingRef.current = false;
    setActiveCard(null);
    setActiveListId(null);
    if (!over) {
      refetchBoard();
      return;
    }

    // Reordering lists
    if (active.data.current?.type === "list") {
      if (active.id !== over.id) {
        const oldIndex = columns.findIndex((c) => c.id === active.id);
        const newIndex = columns.findIndex((c) => c.id === over.id);
        if (oldIndex >= 0 && newIndex >= 0) {
          const next = arrayMove(columns, oldIndex, newIndex);
          setColumns(next);
          reorderLists.mutate(next.map((c) => c.id));
        }
      }
      return;
    }

    // Reordering / moving a card
    const activeId = String(active.id);
    const overId = String(over.id);
    const targetCol = findColumn(overId) ?? findColumn(activeId);
    if (!targetCol) {
      refetchBoard();
      return;
    }

    let cards = targetCol.cards;
    const oldIndex = cards.findIndex((c) => c.id === activeId);
    let newIndex = cards.findIndex((c) => c.id === overId);
    if (newIndex < 0) newIndex = cards.length - 1;

    if (oldIndex >= 0 && oldIndex !== newIndex) {
      cards = arrayMove(cards, oldIndex, newIndex);
      setColumns((cols) => cols.map((c) => (c.id === targetCol.id ? { ...c, cards } : c)));
    }
    const finalIndex = cards.findIndex((c) => c.id === activeId);
    moveCard.mutate({ cardId: activeId, toListId: targetCol.id, toIndex: Math.max(finalIndex, 0) });
  }

  if (boardQuery.isLoading) return <Spinner label="Loading board…" />;
  if (boardQuery.isError || !boardQuery.data)
    return (
      <div className="p-10 text-center text-slate-500 dark:text-slate-400">
        Could not load this board.{" "}
        <Link to="/" className="text-brand-600 hover:underline dark:text-brand-500">
          Back to boards
        </Link>
      </div>
    );

  const board = boardQuery.data;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Board header */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Link to="/" className="text-sm text-brand-600 hover:underline dark:text-brand-500">
            ← Boards
          </Link>
          <BoardTitle board={board} onSave={(title) => patchBoard.mutate({ title })} />
          {board.archived && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
              Archived
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowMembers(true)}>
              <Users size={15} /> Members ({board.members.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => patchBoard.mutate({ archived: !board.archived })}
            >
              {board.archived ? "Restore board" : "Archive board"}
            </Button>
          </div>
        </div>
        {error && (
          <p
            className="mb-2 rounded bg-red-50 px-3 py-1.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
            onClick={() => setError("")}
          >
            {error} (click to dismiss)
          </p>
        )}
        <FilterBar board={board} filters={filters} onChange={setFilters} />
      </div>

      {/* Board body */}
      <div className="scrollbar-thin flex-1 overflow-x-auto bg-slate-100 p-4 dark:bg-slate-950">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full items-start gap-3">
            <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              {columns.map((list) => (
                <BoardColumn
                  key={list.id}
                  list={list}
                  matchingCardIds={matchingCardIds}
                  onAddCard={(listId, title) => addCard.mutate({ listId, title })}
                  onRenameList={(id, title) => renameList.mutate({ id, title })}
                  onDeleteList={(id) => deleteList.mutate(id)}
                  onOpenCard={(id) => setOpenCardId(id)}
                />
              ))}
            </SortableContext>

            <AddListButton onAdd={(title) => addList.mutate(title)} />
          </div>

          <DragOverlay>
            {activeCard ? (
              <div className="w-72 rotate-2">
                <CardCardContent card={activeCard} />
              </div>
            ) : activeListId ? (
              <div className="w-72 rounded-xl bg-slate-200 p-2 text-sm font-semibold text-slate-600 shadow-lg dark:bg-slate-800 dark:text-slate-300">
                {columns.find((c) => c.id === activeListId)?.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {openCardId && (
        <CardModal cardId={openCardId} board={board} onClose={() => setOpenCardId(null)} />
      )}
      {showMembers && (
        <MembersModal board={board} onClose={() => setShowMembers(false)} onChanged={refetchBoard} />
      )}
    </div>
  );
}

function BoardTitle({ board, onSave }: { board: BoardDetail; onSave: (t: string) => void }) {
  const [value, setValue] = useState(board.title);
  const [editing, setEditing] = useState(false);
  useEffect(() => setValue(board.title), [board.title]);

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const t = value.trim();
          if (t && t !== board.title) onSave(t);
          else setValue(board.title);
          setEditing(false);
        }}
        className="rounded border border-brand-500 bg-white px-1.5 py-0.5 text-lg font-bold dark:bg-slate-800 dark:text-slate-100"
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className="rounded px-1 py-0.5 text-lg font-bold text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      {board.title}
    </button>
  );
}

function AddListButton({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-72 shrink-0 items-center gap-1.5 rounded-xl bg-slate-200/60 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Plus size={16} /> Add a list
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = title.trim();
        if (t) onAdd(t);
        setTitle("");
        setOpen(false);
      }}
      className="w-72 shrink-0 rounded-xl bg-slate-200 p-2 dark:bg-slate-800"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => setOpen(false)}
        placeholder="List title…"
        className="mb-2 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
      <Button size="sm" type="submit">
        Add list
      </Button>
    </form>
  );
}
