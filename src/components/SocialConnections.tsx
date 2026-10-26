import { useEffect, useState } from "react";
import { Link2, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getSocialConnections, startSocialConnection } from "@/lib/social-connections";
import type { Dict } from "@/lib/i18n";

export function SocialConnections({ t }: { t: Dict }) {
  const [connections, setConnections] = useState<
    Array<{ id: string; platform: string; account_name: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const getConnections = useServerFn(getSocialConnections);
  const startConnection = useServerFn(startSocialConnection);

  const refresh = async () => {
    try {
      setConnections(await getConnections());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);

  const connectLinkedIn = async () => {
    setBusy(true);
    try {
      const { url } = await startConnection({ data: { platform: "linkedin" } });
      window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
      setBusy(false);
    }
  };

  const linkedIn = connections.find((connection) => connection.platform === "linkedin");
  return (
    <section className="mb-4 rounded-xl border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t.connectionsTitle}</h2>
        {loading && <Loader2 className="size-4 animate-spin text-primary" />}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-surface/40 p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">LinkedIn</p>
          <p className="truncate text-xs text-muted-foreground">
            {linkedIn ? `${t.connected}: ${linkedIn.account_name}` : t.notConnected}
          </p>
        </div>
        {linkedIn ? (
          <Button variant="ghost" size="sm" disabled title={t.disconnectNotReady}>
            <Unlink className="size-4" />
            {t.disconnect}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={connectLinkedIn} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            {t.connect}
          </Button>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{t.connectionConsent}</p>
    </section>
  );
}
