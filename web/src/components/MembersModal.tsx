import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import type { BoardDetail } from "../lib/types";
import { Avatar, Button, Input, Modal, ModalHeader } from "./ui";

export function MembersModal({
  board,
  onClose,
  onChanged,
}: {
  board: BoardDetail;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const isOwner = board.role === "owner";

  const addMember = useMutation({
    mutationFn: () => api.post(`/boards/${board.id}/members`, { email }),
    onSuccess: () => {
      setEmail("");
      setError("");
      onChanged();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => api.delete(`/boards/${board.id}/members/${userId}`),
    onSuccess: onChanged,
    onError: (e) => setError(errorMessage(e)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    addMember.mutate();
  }

  return (
    <Modal open onClose={onClose}>
      <ModalHeader title="Board members" onClose={onClose} />
      <div className="space-y-4 p-5">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

        <ul className="space-y-2">
          {board.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <Avatar name={m.name} color={m.avatarColor} />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{m.name}</p>
                <p className="text-xs text-slate-400">{m.email}</p>
              </div>
              <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{m.role}</span>
              {isOwner && m.role !== "owner" && (
                <button
                  className="text-slate-400 hover:text-red-600"
                  onClick={() => removeMember.mutate(m.id)}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>

        {isOwner ? (
          <form onSubmit={submit} className="border-t border-slate-200 pt-4 dark:border-slate-700">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Add a member by email</span>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" disabled={addMember.isPending}>
                Add
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              They need a TaskBoard account first. Try <b>alex@example.com</b> or{" "}
              <b>sam@example.com</b> from the seed data.
            </p>
          </form>
        ) : (
          <p className="border-t border-slate-200 pt-4 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
            Only the board owner can add or remove members.
          </p>
        )}
      </div>
    </Modal>
  );
}
