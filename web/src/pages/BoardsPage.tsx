import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Plus, Trash2, Users } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import type { BoardSummary } from "../lib/types";
import { Avatar, Button, Input, Modal, ModalHeader, Spinner, Textarea } from "../components/ui";
import { relativeTime } from "../lib/format";

export default function BoardsPage() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  const boardsQuery = useQuery({
    queryKey: ["boards", { archived: showArchived }],
    queryFn: async () => {
      const { data } = await api.get<{ boards: BoardSummary[] }>("/boards", {
        params: { archived: showArchived },
      });
      return data.boards;
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (b: BoardSummary) =>
      api.patch(`/boards/${b.id}`, { archived: !b.archived }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boards"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/boards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boards"] }),
  });

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">
          {showArchived ? "Archived boards" : "Your boards"}
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Back to active" : "View archived"}
          </Button>
          {!showArchived && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> New board
            </Button>
          )}
        </div>
      </div>

      {boardsQuery.isLoading ? (
        <Spinner label="Loading boards…" />
      ) : boardsQuery.data && boardsQuery.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boardsQuery.data.map((board) => (
            <div
              key={board.id}
              className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <Link to={`/boards/${board.id}`} className="flex-1">
                <h2 className="font-semibold text-slate-800">{board.title}</h2>
                {board.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{board.description}</p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                  <span>{board.listCount} lists</span>
                  <span className="flex items-center gap-1">
                    <Users size={12} /> {board.memberCount}
                  </span>
                  <span>· updated {relativeTime(board.updatedAt)}</span>
                </div>
              </Link>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Avatar name={board.owner.name} color={board.owner.avatarColor} size={22} />
                  {board.isOwner ? "You own this" : `${board.owner.name}'s board`}
                </div>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    title={board.archived ? "Restore" : "Archive"}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    onClick={() => archiveMutation.mutate(board)}
                  >
                    {board.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  </button>
                  {board.isOwner && (
                    <button
                      title="Delete permanently"
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      onClick={() => {
                        if (confirm(`Delete "${board.title}" and everything in it? This cannot be undone.`))
                          deleteMutation.mutate(board.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">
            {showArchived ? "No archived boards." : "No boards yet — create your first one."}
          </p>
          {!showArchived && (
            <Button className="mt-4" onClick={() => setCreating(true)}>
              <Plus size={16} /> New board
            </Button>
          )}
        </div>
      )}

      <CreateBoardModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          qc.invalidateQueries({ queryKey: ["boards"] });
        }}
      />
    </div>
  );
}

function CreateBoardModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.post("/boards", { title, description: description || undefined }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setError("");
      onCreated();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title="Create a board" onClose={onClose} />
      <form onSubmit={submit} className="space-y-4 p-5">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Board title</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Description (optional)</span>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <p className="text-xs text-slate-400">
          New boards start with “To Do / In Progress / Done” lists and a set of labels.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create board"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
