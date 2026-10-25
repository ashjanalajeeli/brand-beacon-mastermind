import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, LogOut } from "lucide-react";
import type { UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BriefForm } from "@/components/BriefForm";
import { ChatPanel } from "@/components/ChatPanel";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { dict, type Lang } from "@/lib/i18n";
import {
  clearMessages,
  getBrief,
  getMessages,
  saveBrief,
  saveMessage,
  type BriefInput,
} from "@/lib/marketing.functions";
import logo from "@/assets/logo.png";
import { marketingSettingsSchema } from "@/lib/marketing-settings";

const emptyBrief: BriefInput = {
  project_name: "",
  idea: "",
  audience: "",
  duration: "",
  budget: "",
  country: "",
  language: "ar",
  notes: "",
  competitor_scope: "domestic",
  paid_ads: false,
  platforms: [],
  competitor_links: "",
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "نُمُو — وكيل التسويق الرقمي بالذكاء الاصطناعي" },
      {
        name: "description",
        content:
          "فريق تسويق متكامل بالذكاء الاصطناعي: استراتيجية، خطط أسبوعية وشهرية وسنوية، خطة محتوى، كتابة محتوى وسيناريوهات، ورسالة العلامة وقيمها.",
      },
      { property: "og:title", content: "نُمُو — وكيل التسويق الرقمي بالذكاء الاصطناعي" },
      {
        property: "og:description",
        content:
          "فريق تسويق متكامل بالذكاء الاصطناعي: استراتيجية، خطط أسبوعية وشهرية وسنوية، خطة محتوى، كتابة محتوى وسيناريوهات، ورسالة العلامة وقيمها.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [lang, setLang] = useState<Lang>("ar");
  const [brief, setBrief] = useState<BriefInput>(emptyBrief);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const t = dict[lang];

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void (async () => {
      const [briefRow, messageRows] = await Promise.all([getBrief(), getMessages()]);
      if (cancelled) return;
      if (briefRow) {
        setBrief({
          project_name: briefRow.project_name ?? "",
          idea: briefRow.idea ?? "",
          audience: briefRow.audience ?? "",
          duration: briefRow.duration ?? "",
          budget: briefRow.budget ?? "",
          country: briefRow.country ?? "",
          language: briefRow.language ?? "ar",
          notes: briefRow.notes ?? "",
          ...marketingSettingsSchema.parse({
            competitor_scope: briefRow.competitor_scope,
            paid_ads: briefRow.paid_ads,
            platforms: briefRow.platforms,
            competitor_links: briefRow.competitor_links,
          }),
        });
        if (briefRow.language === "ar" || briefRow.language === "en") {
          setLang(briefRow.language);
        }
      }
      setMessages(
        messageRows.map((row) => {
          const content = row.content as { parts?: UIMessage["parts"] } | null;
          return {
            id: row.id,
            role: row.role as "user" | "assistant",
            parts: content?.parts ?? [],
          };
        }),
      );
      setDataReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleSaveBrief = async (next: BriefInput) => {
    const withLang = { ...next, language: lang };
    await saveBrief({ data: withLang });
    setBrief(withLang);
  };

  const handlePersist = (role: "user" | "assistant", content: unknown) => {
    void saveMessage({ data: { role, content } }).catch(() => undefined);
  };

  const handleClear = async () => {
    await clearMessages();
    setMessages([]);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth" });
  };

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main dir={t.dir} className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <img src={logo} alt="" width={32} height={32} className="size-8" />
          <div>
            <p className="text-sm font-semibold leading-tight">{t.appName}</p>
            <p className="text-xs text-muted-foreground">{t.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <LanguageToggle lang={lang} onChange={setLang} />
          <Button variant="ghost" size="sm" className="gap-2" onClick={signOut}>
            <LogOut className="size-4" />
            {t.signOut}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_1fr]">
        <aside className="hidden min-h-0 overflow-y-auto border-e bg-surface/40 p-4 lg:block">
          <h2 className="mb-3 text-sm font-semibold text-surface-foreground">{t.brief}</h2>
          {dataReady && <BriefForm t={t} value={brief} onSave={handleSaveBrief} />}
        </aside>

        <section className="flex min-h-0 flex-col">
          <details className="border-b bg-surface/40 p-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-surface-foreground">
              {t.brief}
            </summary>
            <div className="mt-3">
              {dataReady && <BriefForm t={t} value={brief} onSave={handleSaveBrief} />}
            </div>
          </details>
          <div className="min-h-0 flex-1">
            {dataReady ? (
              <ChatPanel
                t={t}
                lang={lang}
                brief={brief}
                initialMessages={messages}
                onPersist={handlePersist}
                onClear={handleClear}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
