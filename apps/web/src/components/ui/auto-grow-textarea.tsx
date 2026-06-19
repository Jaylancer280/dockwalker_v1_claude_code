'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

interface AutoGrowTextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'rows'
> {
  maxRows?: number;
}

function adjustHeight(el: HTMLTextAreaElement, maxRows: number) {
  el.style.height = 'auto';
  const cs = window.getComputedStyle(el);
  const lineHeight = parseFloat(cs.lineHeight) || 20;
  const paddingTop = parseFloat(cs.paddingTop) || 0;
  const paddingBottom = parseFloat(cs.paddingBottom) || 0;
  const borderTop = parseFloat(cs.borderTopWidth) || 0;
  const borderBottom = parseFloat(cs.borderBottomWidth) || 0;
  const maxHeight = lineHeight * maxRows + paddingTop + paddingBottom + borderTop + borderBottom;
  if (el.scrollHeight > maxHeight) {
    el.style.height = `${maxHeight}px`;
    el.style.overflowY = 'auto';
  } else {
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = 'hidden';
  }
}

export const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, AutoGrowTextareaProps>(
  function AutoGrowTextarea({ maxRows = 6, value, onInput, ...rest }, externalRef) {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(externalRef, () => internalRef.current as HTMLTextAreaElement);

    useEffect(() => {
      if (internalRef.current) adjustHeight(internalRef.current, maxRows);
    }, [value, maxRows]);

    return (
      <textarea
        ref={internalRef}
        value={value}
        rows={1}
        onInput={(e) => {
          adjustHeight(e.currentTarget, maxRows);
          onInput?.(e);
        }}
        {...rest}
      />
    );
  },
);
