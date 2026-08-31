import { Link, useNavigate } from "react-router-dom";
import { LayoutGrid, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Avatar } from "./ui";
import { useState } from "react";

export function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-3 sm:px-5">
        <Link to="/" className="flex items-center gap-2 font-bold text-slate-800">
          <LayoutGrid className="text-brand-600" size={22} />
          <span>TaskBoard</span>
        </Link>

        {user && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-slate-100"
            >
              <Avatar name={user.name} color={user.avatarColor} />
              <span className="hidden text-sm font-medium text-slate-700 sm:block">{user.name}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <div className="px-3 py-2 text-xs text-slate-500">{user.email}</div>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => navigate("/account")}
                >
                  <UserIcon size={16} /> Account settings
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  onClick={async () => {
                    await logout();
                    navigate("/login");
                  }}
                >
                  <LogOut size={16} /> Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
