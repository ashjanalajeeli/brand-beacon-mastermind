import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dict } from "@/lib/i18n";
import type { BriefInput } from "@/lib/marketing.functions";

export function BriefForm({
  t,
  value,
  onSave,
}: {
  t: Dict;
  value: BriefInput;
  onSave: (brief: BriefInput) => Promise<void>;
}) {
  const [form, setForm] = useState<BriefInput>(value);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof BriefInput, v: string) => setForm((prev) => ({ ...prev, [key]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      toast.success(t.saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="project_name">{t.projectName}</Label>
        <Input
          id="project_name"
          value={form.project_name}
          onChange={(e) => set("project_name", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="idea">{t.idea}</Label>
        <Textarea id="idea" rows={4} value={form.idea} onChange={(e) => set("idea", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="audience">{t.audience}</Label>
        <Textarea
          id="audience"
          rows={2}
          value={form.audience}
          onChange={(e) => set("audience", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="duration">{t.duration}</Label>
          <Input id="duration" value={form.duration} onChange={(e) => set("duration", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="budget">{t.budget}</Label>
          <Input id="budget" value={form.budget} onChange={(e) => set("budget", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="country">{t.country}</Label>
        <Input id="country" value={form.country} onChange={(e) => set("country", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.notes}</Label>
        <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {t.save}
      </Button>
    </form>
  );
}
