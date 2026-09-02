import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CalendarClock,
  CheckSquare,
  Clock,
  MessageSquare,
  Plus,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "../lib/api";
import type { Activity, BoardDetail, CardDetail } from "../lib/types";
import { Avatar, Button, Modal, ModalHeader, Spinner, Textarea } from "./ui";
import { useAuth } from "../lib/auth";
import { activityText, relativeTime, toDateTimeLocal } from "../lib/format";

export function CardModal({
  cardId,
  board,
  onClose,
}: {
  cardId: string;
  board: BoardDetail;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const cardQuery = useQuery({
    queryKey: ["card", cardId],
    queryFn: async () => (await api.get<{ card: CardDetail }>(`/cards/${cardId}`)).data.card,
  });
  const activityQuery = useQuery({
    queryKey: ["activity", cardId],
    queryFn: async () =>
      (await api.get<{ activities: Activity[] }>(`/cards/${cardId}/activity`)).data.activities,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["card", cardId] });
    qc.invalidateQueries({ queryKey: ["activity", cardId] });
    qc.invalidateQueries({ queryKey: ["board", board.id] });
  };

  const patchCard = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/cards/${cardId}`, body),
    onSuccess: invalidate,
  });
  const toggleLabel = useMutation({
    mutationFn: ({ labelId, on }: { labelId: string; on: boolean }) =>
      on
        ? api.post(`/cards/${cardId}/labels`, { labelId })
        : api.delete(`/cards/${cardId}/labels/${labelId}`),
    onSuccess: invalidate,
  });
  const toggleAssignee = useMutation({
    mutationFn: ({ userId, on }: { userId: string; on: boolean }) =>
      on
        ? api.post(`/cards/${cardId}/assignees`, { userId })
        : api.delete(`/cards/${cardId}/assignees/${userId}`),
    onSuccess: invalidate,
  });
  const addComment = useMutation({
    mutationFn: (body: string) => api.post(`/cards/${cardId}/comments`, { body }),
    onSuccess: invalidate,
  });
  const deleteComment = useMutation({
    mutationFn: (id: string) => api.delete(`/comments/${id}`),
    onSuccess: invalidate,
  });
  const addChecklist = useMutation({
    mutationFn: (title: string) => api.post(`/cards/${cardId}/checklists`, { title }),
    onSuccess: invalidate,
  });
  const deleteChecklist = useMutation({
    mutationFn: (id: string) => api.delete(`/checklists/${id}`),
    onSuccess: invalidate,
  });
  const addItem = useMutation({
    mutationFn: ({ checklistId, text }: { checklistId: string; text: string }) =>
      api.post(`/checklists/${checklistId}/items`, { text }),
    onSuccess: invalidate,
  });
  const patchItem = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/checklist-items/${id}`, body),
    onSuccess: invalidate,
  });
  const deleteItem = useMutation({
    mutationFn: (id: string) => api.delete(`/checklist-items/${id}`),
    onSuccess: invalidate,
  });
  const deleteCard = useMutation({
    mutationFn: () => api.delete(`/cards/${cardId}`),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  const card = cardQuery.data;

  return (
    <Modal open onClose={onClose} wide>
      {!card ? (
        <Spinner label="Loading card…" />
      ) : (
        <>
          <ModalHeader
            title={<CardTitleEditor card={card} onSave={(title) => patchCard.mutate({ title })} />}
            onClose={onClose}
          />
          <div className="max-h-[75vh] overflow-y-auto p-5">
            <p className="mb-4 text-xs text-slate-400">
              in list <span className="font-medium text-slate-600 dark:text-slate-300">{card.list.title}</span> · created{" "}
              {relativeTime(card.createdAt)}
            </p>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-6 md:col-span-2">
                {/* Labels */}
                <Section icon={<Tag size={15} />} title="Labels">
                  <div className="flex flex-wrap gap-1.5">
                    {board.labels.map((l) => {
                      const on = card.labels.some((cl) => cl.id === l.id);
                      return (
                        <button
                          key={l.id}
                          onClick={() => toggleLabel.mutate({ labelId: l.id, on: !on })}
                          className="rounded px-2 py-1 text-xs font-medium text-white transition"
                          style={{ background: l.color, opacity: on ? 1 : 0.35 }}
                        >
                          {l.name}
                        </button>
                      );
                    })}
                    {board.labels.length === 0 && (
                      <span className="text-xs text-slate-400">No labels on this board yet.</span>
                    )}
                  </div>
                </Section>

                {/* Description */}
                <Section icon={<span className="text-slate-400">≡</span>} title="Description">
                  <DescriptionEditor
                    value={card.description}
                    onSave={(description) => patchCard.mutate({ description })}
                  />
                </Section>

                {/* Checklists */}
                <Section icon={<CheckSquare size={15} />} title="Checklists">
                  <div className="space-y-4">
                    {card.checklists.map((cl) => {
                      const done = cl.items.filter((i) => i.done).length;
                      return (
                        <div key={cl.id}>
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              {cl.title}{" "}
                              <span className="text-xs text-slate-400">
                                {done}/{cl.items.length}
                              </span>
                            </p>
                            <button
                              className="text-slate-400 hover:text-red-600"
                              onClick={() => deleteChecklist.mutate(cl.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-full bg-brand-500 transition-all"
                              style={{
                                width: `${cl.items.length ? (done / cl.items.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <ul className="space-y-1">
                            {cl.items.map((it) => (
                              <li key={it.id} className="group flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={it.done}
                                  onChange={(e) =>
                                    patchItem.mutate({ id: it.id, body: { done: e.target.checked } })
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
                                />
                                <span
                                  className={`flex-1 text-sm ${
                                    it.done ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-700 dark:text-slate-200"
                                  }`}
                                >
                                  {it.text}
                                </span>
                                <button
                                  className="text-slate-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
                                  onClick={() => deleteItem.mutate(it.id)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </li>
                            ))}
                          </ul>
                          <AddInline
                            placeholder="Add an item…"
                            onAdd={(text) => addItem.mutate({ checklistId: cl.id, text })}
                          />
                        </div>
                      );
                    })}
                    <AddInline
                      placeholder="Add a checklist (e.g. “Acceptance criteria”)…"
                      onAdd={(title) => addChecklist.mutate(title)}
                      buttonLabel="Add checklist"
                    />
                  </div>
                </Section>

                {/* Comments */}
                <Section icon={<MessageSquare size={15} />} title="Comments">
                  <CommentComposer onSubmit={(b) => addComment.mutate(b)} />
                  <ul className="mt-3 space-y-3">
                    {card.comments.map((c) => (
                      <li key={c.id} className="flex gap-2">
                        <Avatar name={c.user.name} color={c.user.avatarColor} />
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium text-slate-800 dark:text-slate-100">{c.user.name}</span>{" "}
                            <span className="text-xs text-slate-400">{relativeTime(c.createdAt)}</span>
                          </p>
                          <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{c.body}</p>
                          {user?.id === c.user.id && (
                            <button
                              className="mt-0.5 text-xs text-slate-400 hover:text-red-600"
                              onClick={() => deleteComment.mutate(c.id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                    {card.comments.length === 0 && (
                      <li className="text-xs text-slate-400">No comments yet.</li>
                    )}
                  </ul>
                </Section>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Section icon={<Users size={15} />} title="Assignees">
                  <div className="space-y-1">
                    {board.members.map((m) => {
                      const on = card.assignees.some((a) => a.id === m.id);
                      return (
                        <label
                          key={m.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleAssignee.mutate({ userId: m.id, on: !on })}
                            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                          <Avatar name={m.name} color={m.avatarColor} size={22} />
                          <span className="text-sm text-slate-700 dark:text-slate-200">{m.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </Section>

                <Section icon={<CalendarClock size={15} />} title="Due date">
                  <input
                    type="datetime-local"
                    value={toDateTimeLocal(card.dueDate)}
                    onChange={(e) =>
                      patchCard.mutate({
                        dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {card.dueDate && (
                    <button
                      className="mt-1 text-xs text-slate-400 hover:text-red-600"
                      onClick={() => patchCard.mutate({ dueDate: null })}
                    >
                      Clear due date
                    </button>
                  )}
                </Section>

                <Section icon={<Clock size={15} />} title="Activity">
                  <ul className="space-y-2">
                    {activityQuery.data?.map((a) => (
                      <li key={a.id} className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Avatar name={a.user.name} color={a.user.avatarColor} size={18} />
                        <span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{a.user.name}</span>{" "}
                          {activityText(a.type, a.data)}
                          <span className="block text-[11px] text-slate-400">
                            {relativeTime(a.createdAt)}
                          </span>
                        </span>
                      </li>
                    ))}
                    {activityQuery.data?.length === 0 && (
                      <li className="text-xs text-slate-400">No activity yet.</li>
                    )}
                  </ul>
                </Section>

                <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => patchCard.mutate({ archived: !card.archived })}
                  >
                    <Archive size={14} /> {card.archived ? "Restore card" : "Archive card"}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      if (confirm("Delete this card permanently?")) deleteCard.mutate();
                    }}
                  >
                    <Trash2 size={14} /> Delete card
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function CardTitleEditor({ card, onSave }: { card: CardDetail; onSave: (t: string) => void }) {
  const [value, setValue] = useState(card.title);
  useEffect(() => setValue(card.title), [card.title]);
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const t = value.trim();
        if (t && t !== card.title) onSave(t);
        else setValue(card.title);
      }}
      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-lg font-semibold text-slate-900 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:outline-none dark:text-slate-100 dark:hover:border-slate-600 dark:focus:bg-slate-800"
    />
  );
}

function DescriptionEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => setDraft(value), [value]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="block w-full whitespace-pre-wrap rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
      >
        {value || <span className="text-slate-400">Add a more detailed description…</span>}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            onSave(draft);
            setEditing(false);
          }}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(value);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function AddInline({
  placeholder,
  onAdd,
  buttonLabel = "Add",
}: {
  placeholder: string;
  onAdd: (text: string) => void;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <Plus size={13} /> {buttonLabel}
      </button>
    );
  }
  return (
    <form
      className="mt-1 flex gap-1"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        const t = text.trim();
        if (t) onAdd(t);
        setText("");
        setOpen(false);
      }}
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
      <Button size="sm" type="submit">
        Add
      </Button>
    </form>
  );
}

function CommentComposer({ onSubmit }: { onSubmit: (body: string) => void }) {
  const [body, setBody] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const b = body.trim();
        if (b) onSubmit(b);
        setBody("");
      }}
      className="space-y-2"
    >
      <Textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a comment…"
      />
      <Button size="sm" type="submit" disabled={!body.trim()}>
        Comment
      </Button>
    </form>
  );
}
