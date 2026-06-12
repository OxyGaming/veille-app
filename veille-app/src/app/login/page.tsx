"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";

export default function LoginPage() {
  // useSearchParams() exige un boundary Suspense en build production
  // (sinon Next.js échoue avec « missing-suspense-with-csr-bailout »).
  return (
    <Suspense fallback={<div />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/procedures";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Identifiants invalides");
      }
      router.replace(from);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8 bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 grid place-items-center shadow-sm">
            <Icon.ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-lg font-bold leading-none">Veille</div>
            <div className="text-[10px] font-mono tracking-wider text-slate-500 mt-1">
              PROCÉDURES TERRAIN
            </div>
          </div>
        </div>
        <div className="card p-6">
          <h1 className="text-xl font-bold">Connexion</h1>
          <p className="text-sm text-slate-500 mt-1">
            Procédures, agents et actions terrain.
          </p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </div>
            {error && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <Icon.AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn btn-primary w-full justify-center"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
          <div className="mt-4 text-[11px] text-slate-500 text-center">
            Compte fourni par l&apos;administrateur.
          </div>
        </div>
      </div>
    </main>
  );
}
