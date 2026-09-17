import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/hooks/useAuth";
import { dict, type Lang } from "@/lib/i18n";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | نُمُو وكيل التسويق الرقمي" },
      {
        name: "description",
        content: "سجّل الدخول إلى نُمُو لإعداد خططك التسويقية ومحتواك بالذكاء الاصطناعي.",
      },
      { property: "og:title", content: "تسجيل الدخول | نُمُو وكيل التسويق الرقمي" },
      {
        property: "og:description",
        content: "سجّل الدخول إلى نُمُو لإعداد خططك التسويقية ومحتواك بالذكاء الاصطناعي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [lang, setLang] = useState<Lang>("ar");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const t = dict[lang];

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success(
          lang === "ar"
            ? "تم إنشاء الحساب. تحقق من بريدك لتأكيد الحساب."
            : "Account created. Check your email to confirm.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        void navigate({ to: "/" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/" });
  };

  return (
    <main dir={t.dir} className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="" width={32} height={32} className="size-8" />
          <span className="font-semibold">{t.appName}</span>
        </div>
        <LanguageToggle lang={lang} onChange={setLang} />
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-6 py-8 lg:grid-cols-2">
        <section className="space-y-4">
          <h1 className="text-3xl font-bold sm:text-4xl">
            <span className="text-brand-gradient">{t.tagline}</span>
          </h1>
          <p className="text-muted-foreground">{t.heroDesc}</p>
          <ul className="grid gap-2 text-sm text-surface-foreground sm:grid-cols-2">
            {t.quick.slice(0, 8).map((q) => (
              <li key={q.label} className="rounded-lg border bg-card px-3 py-2 shadow-soft">
                {q.label}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border bg-card p-6 shadow-lift">
          <h2 className="text-xl font-semibold">{mode === "signin" ? t.signIn : t.signUp}</h2>
          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">{t.fullName}</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t.password}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "signin" ? t.signIn : t.signUp}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>{lang === "ar" ? "أو" : "or"}</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={google}>
            {t.google}
          </Button>

          <button
            type="button"
            className="mt-4 w-full text-sm text-primary hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? t.noAccount : t.haveAccount}
          </button>
        </section>
      </div>
    </main>
  );
}
