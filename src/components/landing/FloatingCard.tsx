'use client';

import { useState, useEffect } from 'react';
import useOnMount from '../../hooks/useOnMount';
import styles from './FloatingCard.module.css';

interface FloatingCardProps {
  side: 'left' | 'right';
  label: string;
  quote: string;
  icon?: string;
}

export default function FloatingCard({ side, label, quote, icon }: FloatingCardProps) {
  const mounted = useOnMount();
  const [floating, setFloating] = useState(false);

  const sideClass = side === 'left' ? styles.left : styles.right;

  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(() => setFloating(true), 800);
      return () => clearTimeout(timer);
    }
  }, [mounted]);

  return (
    <div className={`${styles.card} ${sideClass} ${mounted ? styles.entered : ''} ${floating ? styles.floating : ''}`}>
      <div className={styles.label}>{icon}{icon ? ' ' : ''}{label}</div>
      <p className={styles.quote}>{quote}</p>
    </div>
  );
}
