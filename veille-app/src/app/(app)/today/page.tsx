import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isTodayEnabled } from "@/lib/featureFlags";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  if (!isTodayEnabled()) redirect("/procedures");
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-10 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900">Aujourd&apos;hui</h1>
      <p className="mt-2 text-sm text-slate-600">
        Bonjour {user.name}. Cette page sera enrichie au fil du Sprint 2.
      </p>
      <div
        className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500"
        role="status"
      >
        Squelette livré. Sections à venir&nbsp;: salutation contextuelle, carte
        «&nbsp;En cours&nbsp;», «&nbsp;À traiter aujourd&apos;hui&nbsp;»,
        raccourcis, dernières activités.
      </div>
    </div>
  );
}
