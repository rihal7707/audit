// src/components/assistant/assistant-markdown.tsx
'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';

const ALLOWED_ELEMENTS = ['p', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'blockquote', 'a'];

function safeUrlTransform(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return '';
}

export function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-xs leading-relaxed text-ink">
      <ReactMarkdown
        skipHtml
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        urlTransform={safeUrlTransform}
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded bg-subtle px-1 py-0.5 font-mono text-[11px]">{children}</code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-2.5 text-muted italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) =>
            href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-medium text-teal-700 underline"
              >
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
