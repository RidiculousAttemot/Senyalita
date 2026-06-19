import { useRef, useState, useEffect, type RefObject } from 'react';

interface UseInViewOptions {
  threshold?: number;
  triggerOnce?: boolean;
}

export default function useInView<T extends HTMLElement = HTMLDivElement>(
  options: UseInViewOptions = {}
): [RefObject<T | null>, boolean] {
  const { threshold = 0.15, triggerOnce = true } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (triggerOnce) observer.unobserve(el);
        } else if (!triggerOnce) {
          setInView(false);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, triggerOnce]);

  return [ref, inView];
}
