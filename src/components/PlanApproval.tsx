import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCheck, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { approvePlan, type BriefInput } from "@/lib/marketing.functions";
import { platformNames } from "@/lib/marketing-settings";
import type { Dict, Lang } from "@/lib/i18n";

export function PlanApproval({
  content,
  brief,
  t,
  lang,
  onPrepare,
}: {
  content: string;
  brief: BriefInput;
  t: Dict;
  lang: Lang;
  onPrepare: (prompt: string, planId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const approve = useServerFn(approvePlan);
  const submit = async () => {
    if (!confirmed || !brief.platforms.length || busy) return;
    setBusy(true);
    try {
      const { id: planId } = await approve({
        data: { content, platforms: brief.platforms, paid_ads: brief.paid_ads, approved: true },
      });
      setApproved(true);
      setOpen(false);
      toast.success(t.approved);
      onPrepare(
        lang === "ar"
          ? `وافقت على الخطة التالية. جهّز تنفيذها كمحتوى نهائي مستقل لكل منصة مختارة: ${brief.platforms.map((p) => platformNames[p]).join("، ")}. أدرج النص والوسوم والدعوة للإجراء ومتطلبات الصور أو الفيديو وجدول النشر المقترح. لا تدّعي النشر أو الجدولة الفعلية؛ الحسابات غير مربوطة. ${brief.paid_ads ? "الإعلانات مقترحات فقط بدون إطلاق أو دفع." : "بدون أي إعلانات ممولة؛ ميزانية الإعلان صفر."}\nالخطة المعتمدة:\n${content}`
          : `I approved this plan. Prepare finished content separately for these selected platforms: ${brief.platforms.map((p) => platformNames[p]).join(", ")}. Include copy, hashtags, CTA, media requirements and proposed posting schedule. Do not claim publication or actual scheduling; accounts are not connected. ${brief.paid_ads ? "Ads are proposals only; no launch or spend." : "No paid advertising; advertising spend is zero."}\nApproved plan:\n${content}`,
        planId,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!brief.platforms.length) {
              toast.error(t.selectPlatforms);
              return;
            }
            setConfirmed(false);
            setOpen(true);
          }}
          disabled={approved}
        >
          <CheckCheck className="size-4" />
          {approved ? t.approved : t.approvePlan}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title={lang === "ar" ? "نسخ المحتوى" : "Copy content"}
          onClick={() => {
            void navigator.clipboard
              .writeText(content)
              .then(() => toast.success(lang === "ar" ? "تم النسخ" : "Copied"))
              .catch(() => toast.error(lang === "ar" ? "تعذر النسخ" : "Copy failed"));
          }}
        >
          <Copy className="size-4" />
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir={t.dir} className="max-h-[85dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.approveTitle}</DialogTitle>
            <DialogDescription>{t.approveDescription}</DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">
            {brief.platforms.map((p) => platformNames[p]).join(" · ")}
          </p>
          <p className="text-xs text-muted-foreground">
            {brief.paid_ads ? t.adsOptIn : t.organicOnly}
          </p>
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words border-y py-3 font-sans text-sm">
            {content}
          </pre>
          <p className="text-sm text-muted-foreground">{t.connectionPending}</p>
          <div className="flex items-center gap-2">
            <Checkbox
              id="approve-version"
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
            />
            <Label htmlFor="approve-version">{t.confirmApproval}</Label>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {t.cancel}
            </Button>
            <Button disabled={!confirmed || busy} onClick={submit}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t.approveAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
