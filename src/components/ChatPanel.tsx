import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useServerFn } from "@tanstack/react-start";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Dict, Lang } from "@/lib/i18n";
import { savePreparedContent, type BriefInput } from "@/lib/marketing.functions";
import logo from "@/assets/logo.png";
import { PlanApproval } from "@/components/PlanApproval";

type Props = {
  t: Dict;
  lang: Lang;
  brief: BriefInput;
  initialMessages: UIMessage[];
  onPersist: (role: "user" | "assistant", content: unknown) => void;
  onClear: () => Promise<void>;
};

export function ChatPanel({ t, lang, brief, initialMessages, onPersist, onClear }: Props) {
  const briefRef = useRef(brief);
  briefRef.current = brief;
  const langRef = useRef(lang);
  langRef.current = lang;
  const pendingPreparationRef = useRef<{ planId: string; platforms: string[] } | null>(null);
  const savePrepared = useServerFn(savePreparedContent);

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: "marketing-agent",
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token
          ? { Authorization: `Bearer ${data.session.access_token}` }
          : {};
      },
      body: () => ({ brief: briefRef.current, language: langRef.current }),
    }),
    onFinish: ({ message }) => {
      onPersist("assistant", message);
      const pending = pendingPreparationRef.current;
      const content = message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim();
      if (pending && content) {
        pendingPreparationRef.current = null;
        void savePrepared({
          data: { plan_id: pending.planId, platforms: pending.platforms, content },
        }).catch((error) => toast.error(error instanceof Error ? error.message : "Error"));
      }
    },
    onError: (error) => toast.error(error.message || "Error"),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus();
  }, [isLoading]);

  const send = (text: string) => {
    const value = text.trim();
    if (!value || isLoading) return;
    setInput("");
    onPersist("user", { role: "user", parts: [{ type: "text", text: value }] });
    void sendMessage({ text: value });
  };

  const reset = async () => {
    await onClear();
    setMessages([]);
    toast.success(t.cleared);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <img src={logo} alt="" width={28} height={28} className="size-7" />
          <span className="font-semibold">{t.chat}</span>
        </div>
        <Button variant="ghost" size="sm" className="gap-2" onClick={reset}>
          <RotateCcw className="size-4" />
          {t.clear}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b bg-surface/60 px-4 py-3">
        {t.quick.map((q) => (
          <Button
            key={q.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => send(q.prompt)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-surface-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {q.label}
          </Button>
        ))}
      </div>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <img src={logo} alt="" width={64} height={64} className="size-16" loading="lazy" />
              <h2 className="text-lg font-semibold">{t.emptyTitle}</h2>
              <p className="max-w-sm text-sm text-muted-foreground">{t.emptyDesc}</p>
            </div>
          )}
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent>
                {message.parts.map((part, i) =>
                  part.type === "text" ? (
                    <MessageResponse key={i}>{part.text}</MessageResponse>
                  ) : null,
                )}
                {message.role === "assistant" &&
                  !isLoading &&
                  message.parts.some((part) => part.type === "text" && part.text.trim()) && (
                    <PlanApproval
                      key={message.id}
                      t={t}
                      lang={lang}
                      brief={brief}
                      content={message.parts
                        .filter((part) => part.type === "text")
                        .map((part) => part.text)
                        .join("\n")}
                      onPrepare={(prompt, planId) => {
                        pendingPreparationRef.current = { planId, platforms: brief.platforms };
                        send(prompt);
                      }}
                    />
                  )}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && (
            <div className="px-2 py-3">
              <Shimmer>{t.thinking}</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl p-4">
        <PromptInput
          onSubmit={(_message, event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.placeholder}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={!input.trim() && !isLoading} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
