import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl">🧭</div>
        <h1 className="text-xl font-bold mt-3">Page introuvable</h1>
        <p className="text-sm text-[var(--muted)] mt-2">
          La ressource demandée n&apos;existe pas ou vous n&apos;y avez pas accès.
        </p>
        <Link
          href="/procedures"
          className="inline-block mt-4 bg-[var(--steel)] text-white font-semibold px-4 py-2 rounded-lg"
        >
          Retour à l&apos;application
        </Link>
      </div>
    </main>
  );
}
