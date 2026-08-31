import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar, Button, Input } from "../components/ui";
import type { User } from "../lib/types";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#6366f1", "#d946ef", "#64748b"];

export default function AccountPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [color, setColor] = useState(user?.avatarColor ?? COLORS[5]);
  const [profileMsg, setProfileMsg] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileMsg("");
    try {
      const { data } = await api.patch<{ user: User }>("/auth/me", { name, avatarColor: color });
      setUser(data.user);
      setProfileMsg("Saved.");
    } catch (err) {
      setProfileMsg(errorMessage(err));
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg("");
    try {
      await api.patch("/auth/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setPwMsg("Password updated.");
    } catch (err) {
      setPwMsg(errorMessage(err));
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-brand-600 hover:underline">
        ← Back
      </button>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Account settings</h1>

      <form onSubmit={saveProfile} className="mb-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-800">Profile</h2>
        <div className="flex items-center gap-3">
          <Avatar name={name || user.name} color={color} size={44} />
          <span className="text-sm text-slate-500">{user.email}</span>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Avatar colour</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ${
                  color === c ? "ring-slate-800" : "ring-transparent"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        {profileMsg && <p className="text-sm text-slate-600">{profileMsg}</p>}
        <Button type="submit">Save profile</Button>
      </form>

      <form onSubmit={changePassword} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-800">Change password</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Current password</span>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">New password</span>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {pwMsg && <p className="text-sm text-slate-600">{pwMsg}</p>}
        <Button type="submit" variant="secondary">
          Update password
        </Button>
      </form>
    </div>
  );
}
