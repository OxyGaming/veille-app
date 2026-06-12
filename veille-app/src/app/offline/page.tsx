export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--surface)] p-6">
      <div className="max-w-sm text-center">
        <div className="text-5xl mb-3">📡</div>
        <h1 className="text-xl font-bold">Hors ligne</h1>
        <p className="text-sm text-[var(--muted)] mt-2">
          Vous pouvez continuer à saisir vos veilles. Les modifications seront
          synchronisées dès que la connexion sera rétablie.
        </p>
        <a
          href="/procedures"
          className="inline-block mt-4 bg-[var(--steel)] text-white font-semibold px-4 py-2 rounded-lg"
        >
          Reprendre la veille
        </a>
      </div>
    </main>
  );
}
