import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dict, type Lang } from "@/lib/i18n";

export function LanguageToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2"
      onClick={() => onChange(lang === "ar" ? "en" : "ar")}
    >
      <Languages className="size-4" />
      {dict[lang].lang}
    </Button>
  );
}
