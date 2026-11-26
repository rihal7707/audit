// src/components/assistant/assistant-side-panel.tsx
'use client';

import * as React from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { MessageSquare } from 'lucide-react';
import { useMediaQuery } from './use-media-query';
import { AssistantChatPanel, type AssistantChatPanelProps } from './assistant-chat-panel';
import type { AssistantMessageDto } from '@/lib/ai/assistant-types';

export interface AssistantSidePanelHandle {
  openAndFocus: () => void;
}

const DOCK_KEY = 'amk_assistant_dock_open_v1';
const DRAWER_KEY = 'amk_assistant_drawer_open_v1';
const TOGGLE_EVENT = 'amk-assistant-storage-change';

function subscribeStorage(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(TOGGLE_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(TOGGLE_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

function readBoolStorage(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const val = window.sessionStorage.getItem(key);
    if (val === 'true') return true;
    if (val === 'false') return false;
  } catch {
    // ignore storage errors
  }
  return fallback;
}

function writeBoolStorage(key: string, val: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, String(val));
    window.dispatchEvent(new Event(TOGGLE_EVENT));
  } catch {
    // ignore
  }
}

export const AssistantSidePanel = React.forwardRef<
  AssistantSidePanelHandle,
  Omit<AssistantChatPanelProps, 'onClose' | 'inputRef'> & {
    onMessagesChange?: (messages: AssistantMessageDto[]) => void;
  }
>(function AssistantSidePanel(props, ref) {
  const isDesktopDock = useMediaQuery('(min-width: 1280px)', true);
  const isTabletDrawer = useMediaQuery('(min-width: 1024px)', false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const desktopOpen = React.useSyncExternalStore(
    subscribeStorage,
    () => readBoolStorage(DOCK_KEY, true),
    () => true,
  );

  const drawerOpen = React.useSyncExternalStore(
    subscribeStorage,
    () => readBoolStorage(DRAWER_KEY, false),
    () => false,
  );

  React.useImperativeHandle(
    ref,
    () => ({
      openAndFocus: () => {
        if (isDesktopDock) {
          writeBoolStorage(DOCK_KEY, true);
          setTimeout(() => inputRef.current?.focus(), 60);
        } else {
          writeBoolStorage(DRAWER_KEY, true);
          setTimeout(() => inputRef.current?.focus(), 80);
        }
      },
    }),
    [isDesktopDock],
  );

  if (isDesktopDock) {
    if (!desktopOpen) {
      return (
        <button
          type="button"
          onClick={() => writeBoolStorage(DOCK_KEY, true)}
          className="no-print fixed bottom-5 right-5 z-40 inline-flex min-h-[46px] items-center gap-2 rounded-full bg-navy-900 px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:bg-navy-800 cursor-pointer"
        >
          <MessageSquare className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          Ask your audit
        </button>
      );
    }

    return (
      <aside
        aria-label="Ask Your AI Business Consultant"
        className="no-print w-[360px] shrink-0 sticky top-20 h-[calc(100vh-5.5rem)] rounded-lg border border-border overflow-hidden shadow-sm"
      >
        <AssistantChatPanel
          {...props}
          inputRef={inputRef}
          onClose={() => writeBoolStorage(DOCK_KEY, false)}
        />
      </aside>
    );
  }

  return (
    <>
      {!drawerOpen && (
        <button
          type="button"
          onClick={() => writeBoolStorage(DRAWER_KEY, true)}
          className="no-print fixed bottom-4 right-4 z-40 inline-flex min-h-[46px] items-center gap-2 rounded-full bg-navy-900 px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:bg-navy-800 cursor-pointer"
        >
          <MessageSquare className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          Ask your audit
        </button>
      )}

      <RadixDialog.Root open={drawerOpen} onOpenChange={(o) => writeBoolStorage(DRAWER_KEY, o)}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="no-print fixed inset-0 z-50 bg-navy-950/50" />
          <RadixDialog.Content
            aria-label="Ask Your AI Business Consultant"
            className={
              isTabletDrawer
                ? 'no-print fixed inset-y-0 right-0 z-50 flex h-dvh w-[380px] max-w-[92vw] flex-col overflow-hidden border-l border-border bg-surface shadow-xl focus:outline-none'
                : 'no-print fixed inset-x-0 bottom-0 top-12 z-50 flex h-[calc(100dvh-3rem)] flex-col overflow-hidden rounded-t-xl border-t border-border bg-surface shadow-xl focus:outline-none'
            }
          >
            <RadixDialog.Title className="sr-only">Ask Your AI Business Consultant</RadixDialog.Title>
            <AssistantChatPanel
              {...props}
              inputRef={inputRef}
              onClose={() => writeBoolStorage(DRAWER_KEY, false)}
            />
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </>
  );
});
