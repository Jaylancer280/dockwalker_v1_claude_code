'use client';

import { useState, useRef, useEffect } from 'react';

interface ExpandableTextProps {
  text: string;
  maxLines?: number;
  className?: string;
}

export function ExpandableText({ text, maxLines = 3, className = '' }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (ref.current) {
      setClamped(ref.current.scrollHeight > ref.current.clientHeight);
    }
  }, [text]);

  return (
    <div>
      <p
        ref={ref}
        className={`whitespace-pre-wrap break-words ${className} ${!expanded ? `line-clamp-${maxLines}` : ''}`}
        style={
          !expanded
            ? {
                WebkitLineClamp: maxLines,
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
            : undefined
        }
      >
        {text}
      </p>
      {clamped && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 text-xs text-[var(--accent)] hover:underline"
        >
          Read more
        </button>
      )}
      {expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-1 text-xs text-[var(--accent)] hover:underline"
        >
          Show less
        </button>
      )}
    </div>
  );
}
