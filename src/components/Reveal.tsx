import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

interface Props {
  as?: 'div' | 'p' | 'li' | 'article' | 'span' | 'header';
  index?: number;
  className?: string;
  children: ReactNode;
}

/** Fades content up once when it first enters the viewport. Visible by default without JS. */
export function Reveal({ as = 'div', index = 0, className = '', children }: Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add('is-visible');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return createElement(as, { ref, className: `reveal ${className}`.trim(), style: { '--i': index } as CSSProperties }, children);
}
