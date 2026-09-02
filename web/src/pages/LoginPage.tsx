import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/api";
import { Button, Input } from "../components/ui";
import { ThemeToggle } from "../components/TopBar";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname: string } } };
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate(location.state?.from?.pathname ?? "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center px-4 py-12">
      <div className="absolute right-3 top-3">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <LayoutGrid className="text-brand-600 dark:text-brand-500" size={34} />
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Sign in to TaskBoard</h1>
        </div>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </p>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</span>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            No account?{" "}
            <Link to="/register" className="font-medium text-brand-600 hover:underline dark:text-brand-500">
              Create one
            </Link>
          </p>
        </form>
        <p className="mt-4 rounded-md bg-slate-200/60 px-3 py-2 text-center text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          Demo login is pre-filled: <b>demo@example.com</b> / <b>demo1234</b>
        </p>
        <p className="mt-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
          Deployed automatically from <code>main</code> via GitHub Actions.
        </p>
      </div>
    </div>
  );
}
