import { Link, useNavigate } from "react-router-dom";
import { LayoutGrid, LogOut, Moon, Sun, User as UserIcon } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { Avatar } from "./ui";
import { useState } from "react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-3 sm:px-5">
        <Link to="/" className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
          <LayoutGrid className="text-brand-600 dark:text-brand-500" size={22} />
          <span>TaskBoard</span>
        </Link>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar name={user.name} color={user.avatarColor} />
                <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 sm:block">
                  {user.name}
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                    onClick={() => navigate("/account")}
                  >
                    <UserIcon size={16} /> Account settings
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
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
      </div>
    </header>
  );
}
