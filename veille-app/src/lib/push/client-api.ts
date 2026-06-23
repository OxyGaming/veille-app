/**
 * Wrappers `fetch` côté client pour les routes push (C4).
 *
 * Isolés des hooks pour rester testables — un `fetch` injectable permet
 * de mocker simplement la couche réseau dans Vitest.
 */

import type { SubscribeBody, UnsubscribeBody } from "@/lib/push/schemas";

/** Résultat normalisé des appels client. */
export type PushApiResult =
  | { ok: true }
  | { ok: false; status: number; reason: "disabled" | "auth" | "validation" | "server" };

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; credentials?: RequestCredentials; cache?: RequestCache },
) => Promise<{ ok: boolean; status: number }>;

function classify(status: number): Extract<PushApiResult, { ok: false }>["reason"] {
  if (status === 503) return "disabled";
  if (status === 401 || status === 403) return "auth";
  if (status === 400) return "validation";
  return "server";
}

/**
 * POST /api/push/subscribe — wrappe l'appel et normalise le résultat.
 *
 * `fetchImpl` est injectable pour les tests. En prod, le hook utilise
 * `window.fetch` implicitement.
 */
export async function postSubscribe(
  body: SubscribeBody,
  fetchImpl: FetchLike = fetch,
): Promise<PushApiResult> {
  const r = await fetchImpl("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
    cache: "no-store",
  });
  if (r.ok) return { ok: true };
  return { ok: false, status: r.status, reason: classify(r.status) };
}

/**
 * DELETE /api/push/subscribe — idempotent côté serveur (renvoie 200
 * même si la row n'existe pas / appartient à un autre user).
 */
export async function postUnsubscribe(
  body: UnsubscribeBody,
  fetchImpl: FetchLike = fetch,
): Promise<PushApiResult> {
  const r = await fetchImpl("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
    cache: "no-store",
  });
  if (r.ok) return { ok: true };
  return { ok: false, status: r.status, reason: classify(r.status) };
}
