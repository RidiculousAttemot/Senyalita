'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import styles from './LandingNav.module.css';

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <Link href="/" className={styles.brand}>
        <span className={styles.iconBox}>
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </span>
        <span className={styles.brandName}>SIGNWITHUS</span>
      </Link>

      <div className={styles.links}>
        <a href="#how-it-works">
          <span>Why it matters</span>
        </a>
        <a href="#how-it-works">
          <span>How you use it</span>
        </a>
        <a href="#how-it-works">
          <span>How it works</span>
        </a>
      </div>

      <Link href="/translate" className={styles.cta}>
        <span>Open App</span>
        <svg className={styles.ctaArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M13 5l7 7-7 7"/>
        </svg>
      </Link>
    </nav>
  );
}
