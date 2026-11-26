// src/components/assistant/assistant-chat-panel.tsx
'use client';

import * as React from 'react';
import { RotateCcw, Send, Sparkles, X } from 'lucide-react';
import {
  SUGGESTED_ASSISTANT_CHIPS,
  type AssistantCta,
  type AssistantFindingRef,
  type AssistantHistoryDto,
  type AssistantMessageDto,
} from '@/lib/ai/assistant-types';
import { getWillowCreekSampleReply } from '@/lib/sample/willow-creek-assistant';
import type { RoiInputs, RoiScenario, ScenarioKey } from '@/lib/roi/types';
import { useReducedMotion } from '@/components/roi/use-count-up';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AssistantMarkdown } from './assistant-markdown';

export interface AssistantChatPanelProps {
  mode: 'live' | 'sample' | 'preview';
  businessName: string;
  publicToken?: string;
  sampleRoiState?: {
    inputs: RoiInputs;
    scenarios: Record<ScenarioKey, RoiScenario>;
    selectedScenario: ScenarioKey;
  };
  findingsLookup?: Record<string, AssistantFindingRef>;
  onBeforeSendMessage?: () => Promise<void>;
  onScrollToFinding?: (cardId: string) => void;
  onTriggerCta?: (cta: AssistantCta, context: { findingId?: string; opportunityId?: string; lastMessage?: string }) => void;
  onMessagesChange?: (messages: AssistantMessageDto[]) => void;
  onClose?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

const SAMPLE_FINDINGS_FALLBACK: Record<string, AssistantFindingRef> = {
  F1: { id: 'F1', title: 'Consultation positioning', priority: 'MEDIUM', sectionCategory: 'Digital Presence & Messaging', cardId: 'finding-digital-presence-messaging-0' },
  F3: { id: 'F3', title: 'Asynchronous callback form', priority: 'HIGH', sectionCategory: 'Lead Capture & Conversion', cardId: 'finding-lead-capture-conversion-0' },
  F5: { id: 'F5', title: 'Missed phone calls', priority: 'HIGH', sectionCategory: 'Customer Experience & Enquiry Handling', cardId: 'finding-customer-experience-enquiry-handling-0' },
  F6: { id: 'F6', title: 'Disconnected enquiry channels', priority: 'HIGH', sectionCategory: 'Operations, CRM & Follow-Up', cardId: 'finding-operations-crm-follow-up-0' },
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function AssistantChatPanel({
  mode,
  businessName,
  publicToken,
  sampleRoiState,
  findingsLookup: propFindingsLookup,
  onBeforeSendMessage,
  onScrollToFinding,
  onTriggerCta,
  onMessagesChange,
  onClose,
  inputRef,
}: AssistantChatPanelProps) {
  const reduced = useReducedMotion();
  const [messages, setMessages] = React.useState<AssistantMessageDto[]>([]);
  const [conversationId, setConversationId] = React.useState<number | null>(null);
  const [findingsLookup, setFindingsLookup] = React.useState<Record<string, AssistantFindingRef>>(
    propFindingsLookup ?? (mode === 'sample' ? SAMPLE_FINDINGS_FALLBACK : {}),
  );
  const [remaining, setRemaining] = React.useState<number>(10);
  const [maxMessages, setMaxMessages] = React.useState<number>(10);
  const [enabled, setEnabled] = React.useState(true);
  const [configured, setConfigured] = React.useState(mode === 'sample');
  const [unavailableReason, setUnavailableReason] = React.useState<string | undefined>();
  const [inputText, setInputText] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [lastFailed, setLastFailed] = React.useState<{ text: string; chipId?: string } | null>(null);
  const [redactedNotice, setRedactedNotice] = React.useState(false);
  const [sampleLastTopic, setSampleLastTopic] = React.useState<string | undefined>();
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const sampleSeqRef = React.useRef(0);

  React.useEffect(() => {
    if (messages.length > 0 || sending) {
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    onMessagesChange?.(messages);
  }, [messages, sending, onMessagesChange]);

  React.useEffect(() => {
    if (mode !== 'live' || !publicToken) return;
    let active = true;
    const savedConv = typeof window !== 'undefined' ? window.sessionStorage.getItem(`amk_conv_${publicToken}`) : null;
    const qs = new URLSearchParams({ trackOpen: '1' });
    if (savedConv) qs.set('conversationId', savedConv);
    fetch(`/api/reports/${publicToken}/assistant?${qs.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as AssistantHistoryDto;
        if (!active) return;
        setEnabled(data.enabled);
        setConfigured(data.configured);
        setUnavailableReason(data.unavailableReason);
        setConversationId(data.conversationId);
        setRemaining(data.remainingMessages);
        setMaxMessages(data.maxMessages);
        setMessages(data.messages);
        if (data.findingsLookup) setFindingsLookup(data.findingsLookup);
        if (data.conversationId && typeof window !== 'undefined') {
          window.sessionStorage.setItem(`amk_conv_${publicToken}`, String(data.conversationId));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [mode, publicToken]);

  const sendMessage = async (text: string, chipId?: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setErrorMsg(null);
    setLastFailed(null);
    setRedactedNotice(false);

    if (mode === 'sample') {
      const now = new Date().toISOString();
      sampleSeqRef.current += 1;
      const userId = `u_${sampleSeqRef.current}`;
      const asstId = `a_${sampleSeqRef.current}`;
      const userMsg: AssistantMessageDto = {
        id: userId,
        role: 'user',
        message: trimmed,
        status: 'COMPLETED',
        createdAt: now,
      };
      const reply = getWillowCreekSampleReply(trimmed, {
        currency: sampleRoiState?.inputs.currency ?? 'USD',
        roiInputs: sampleRoiState?.inputs,
        scenarios: sampleRoiState?.scenarios,
        selectedScenario: sampleRoiState?.selectedScenario,
        lastTopic: sampleLastTopic,
      });
      setSampleLastTopic(reply.topic);
      const assistantMsg: AssistantMessageDto = {
        id: asstId,
        role: 'assistant',
        message: reply.payload.answer,
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        relatedFindingIds: reply.payload.relatedFindingIds,
        relatedOpportunityIds: reply.payload.relatedOpportunityIds,
        suggestedFollowUpQuestions: reply.payload.suggestedFollowUpQuestions,
        cta: reply.payload.cta,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInputText('');
      return;
    }

    if (mode !== 'live' || !publicToken) return;
    setSending(true);
    try {
      await onBeforeSendMessage?.();
      const res = await fetch(`/api/reports/${publicToken}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, conversationId: conversationId ?? undefined, chipId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        redacted?: boolean;
        conversationId?: number;
        remainingMessages?: number;
        userMessage?: AssistantMessageDto;
        assistantMessage?: AssistantMessageDto;
      };
      if (!res.ok || !json.assistantMessage || !json.userMessage) {
        setErrorMsg(json.error || 'Could not send message. Please retry.');
        setLastFailed({ text: trimmed, chipId });
        return;
      }
      if (json.redacted) setRedactedNotice(true);
      if (json.conversationId) {
        setConversationId(json.conversationId);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(`amk_conv_${publicToken}`, String(json.conversationId));
        }
      }
      if (typeof json.remainingMessages === 'number') setRemaining(json.remainingMessages);
      setMessages((prev) => [...prev, json.userMessage!, json.assistantMessage!]);
      setInputText('');
    } catch {
      setErrorMsg('Network error while contacting the assistant. Please retry.');
      setLastFailed({ text: trimmed, chipId });
    } finally {
      setSending(false);
    }
  };

  const handleNewConversation = async () => {
    if (mode === 'sample') {
      setMessages([]);
      setSampleLastTopic(undefined);
      setErrorMsg(null);
      return;
    }
    if (!publicToken) return;
    const res = await fetch(`/api/reports/${publicToken}/assistant`, { method: 'DELETE' });
    if (res.ok) {
      const json = (await res.json()) as { conversationId: number; remainingMessages: number };
      setConversationId(json.conversationId);
      setRemaining(json.remainingMessages);
      setMessages([]);
      setErrorMsg(null);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(`amk_conv_${publicToken}`, String(json.conversationId));
      }
    }
  };

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.message;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-surface text-ink">
      {/* Header */}
      <div className="shrink-0 flex items-start justify-between gap-2 border-b border-border bg-navy-900 px-4 py-3 text-white">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{mode === 'sample' ? 'Simulated Demo Q&A' : 'Audit Q&A'}</span>
          </div>
          <h2 className="truncate text-sm font-semibold">Ask Your AI Business Consultant</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleNewConversation}
            title="Start new conversation"
            aria-label="Start new conversation"
            className="inline-flex h-8 items-center gap-1 rounded px-2 text-[11px] text-slate-200 hover:bg-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">New</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close assistant panel"
              className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-200 hover:bg-white/10"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Mode / Unavailable notice */}
      {mode === 'sample' && (
        <div className="border-b border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-[11px] font-semibold text-navy-900">
          DEMO ASSISTANT – SAMPLE BUSINESS AND SIMULATED RESPONSES.
        </div>
      )}

      {mode === 'preview' && (
        <div className="p-4 text-xs text-muted">
          Admin preview mode — open the live customer report link to interact with or inspect customer chat history.
        </div>
      )}

      {mode === 'live' && (!enabled || !configured) && (
        <div className="m-3 rounded-md border border-border bg-subtle p-4 text-xs space-y-1">
          <p className="font-semibold text-ink">Assistant not available yet</p>
          <p className="text-muted">{unavailableReason || 'AI assistant is currently unavailable.'}</p>
        </div>
      )}

      {/* Scrollable conversation body */}
      {mode !== 'preview' && (enabled && configured || mode === 'sample') && (
        <>
          <div
            ref={messagesContainerRef}
            className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3 space-y-3"
          >
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-muted">
                  Ask questions about <strong className="text-ink">{businessName}</strong>&apos;s audit findings,
                  roadmap priorities, or your ROI numbers. Every reply stays strictly grounded in your report data.
                </p>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Suggested questions
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_ASSISTANT_CHIPS.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        disabled={sending}
                        onClick={() => void sendMessage(chip.question, chip.id)}
                        className="rounded-full border border-border bg-subtle/70 px-2.5 py-1 text-left text-[11px] font-medium text-ink hover:border-navy-700 hover:bg-subtle transition-colors cursor-pointer"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-xs space-y-2',
                  m.role === 'user'
                    ? 'ml-6 bg-navy-900 text-white'
                    : 'mr-2 border border-border bg-subtle/40 text-ink',
                )}
              >
                {m.role === 'user' ? (
                  <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>
                ) : (
                  <AssistantMarkdown content={m.message} />
                )}

                {m.role === 'assistant' && m.relatedFindingIds && m.relatedFindingIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {m.relatedFindingIds.map((fid) => {
                      const f = findingsLookup[fid];
                      return (
                        <button
                          key={fid}
                          type="button"
                          onClick={() => f?.cardId && onScrollToFinding?.(f.cardId)}
                          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800 hover:bg-emerald-100 cursor-pointer"
                        >
                          {fid}: {f ? f.title.slice(0, 32) : 'Finding'}
                        </button>
                      );
                    })}
                  </div>
                )}

                {m.role === 'assistant' && m.suggestedFollowUpQuestions && m.suggestedFollowUpQuestions.length > 0 && (
                  <div className="flex flex-wrap gap-1 border-t border-border pt-2">
                    {m.suggestedFollowUpQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={sending}
                        onClick={() => void sendMessage(q)}
                        className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted hover:text-ink cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {m.role === 'assistant' && m.cta?.show && (
                  <div className="pt-1">
                    <Button
                      variant="cta"
                      size="sm"
                      onClick={() =>
                        onTriggerCta?.(m.cta!, {
                          findingId: m.relatedFindingIds?.[0],
                          opportunityId: m.relatedOpportunityIds?.[0],
                          lastMessage: lastUserMsg,
                        })
                      }
                    >
                      {m.cta.label || 'Discuss My Audit'}
                    </Button>
                  </div>
                )}

                <p className={cn('text-[10px]', m.role === 'user' ? 'text-slate-300' : 'text-muted')}>
                  {fmtTime(m.createdAt)}
                </p>
              </div>
            ))}

            {sending && (
              <div className="mr-6 rounded-lg border border-border bg-subtle/40 px-3 py-2 text-xs text-muted">
                {reduced ? 'Thinking...' : 'Thinking ···'}
              </div>
            )}

            {errorMsg && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 space-y-1.5">
                <p>{errorMsg}</p>
                {lastFailed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void sendMessage(lastFailed.text, lastFailed.chipId)}
                  >
                    Retry
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Sticky Footer Input */}
          <div className="shrink-0 border-t border-border bg-surface p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-1.5">
            {redactedNotice && (
              <p className="rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
                Sensitive personal details were automatically redacted before sending.
              </p>
            )}
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span>
                {mode === 'sample'
                  ? 'Offline demo replies · nothing stored'
                  : `${remaining} of ${maxMessages} questions remaining`}
              </span>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="text-[10px] font-medium text-teal-700 hover:underline cursor-pointer"
                >
                  Show chips
                </button>
              )}
            </div>
            <p className="text-[10px] leading-tight text-muted">
              {mode === 'sample'
                ? 'Simulated demo assistant — no data is sent to Google Gemini.'
                : "Messages are processed by Google's Gemini AI service. Please don't include personal, patient or confidential information."}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage(inputText);
              }}
              className="flex items-center gap-1.5"
            >
              <input
                ref={inputRef}
                type="text"
                aria-label="Ask a question about your audit report"
                placeholder="Ask about findings or ROI..."
                value={inputText}
                disabled={sending || (mode === 'live' && remaining <= 0)}
                onChange={(e) => setInputText(e.target.value)}
                className="min-h-[42px] min-w-0 flex-1 rounded border border-border bg-surface px-3 text-xs text-ink placeholder:text-muted/70 focus:border-navy-800 focus:outline-none"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                aria-label="Send message"
                disabled={sending || !inputText.trim() || (mode === 'live' && remaining <= 0)}
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
