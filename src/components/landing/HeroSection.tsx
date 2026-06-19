'use client';

import Link from 'next/link';
import useOnMount from '../../hooks/useOnMount';
import FloatingCard from './FloatingCard';
import styles from './HeroSection.module.css';

export default function HeroSection() {
  const mounted = useOnMount();

  const stagger = (delayClass: string) =>
    `${styles.stagger} ${mounted ? styles.staggerVisible : ''} ${styles[delayClass as keyof typeof styles]}`;

  return (
    <section className={styles.hero}>
      <div className={styles.glowOrb1} aria-hidden="true" />
      <div className={styles.glowOrb2} aria-hidden="true" />
      <div className={styles.glowOrb3} aria-hidden="true" />

      <FloatingCard
        side="left"
        label="Community"
        quote="This is the most inclusive communication tool I have ever used."
        icon="🌟"
      />

      <FloatingCard
        side="right"
        label="Teachers"
        quote="It makes classroom interaction seamless for Deaf students."
        icon="💬"
      />

      <div className={styles.center}>
        <div className={`${stagger('delay0')}`}>
          <span className={styles.icon}>
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </span>
        </div>

        <div className={`${stagger('delay1')}`}>
          <span className={styles.badge}>
            ✦ Inclusive communication for Deaf & hearing people
          </span>
        </div>

        <h1 className={`${styles.headline} ${stagger('delay2')}`}>
          <span className={styles.headlineLine1}>A live bridge between</span>
          <span className={styles.headlineLine2}>sign and speech</span>
        </h1>

        <p className={`${styles.body} ${stagger('delay3')}`}>
          SIGNWITHUS lets Deaf and hearing people talk, collaborate, and learn
          together. Type and a signing avatar appears. Sign to the camera and it
          becomes text — and is spoken aloud. Two directions, one shared screen,
          in real time.
        </p>

        <div className={`${styles.buttons} ${stagger('delay4')}`}>
          <Link href="/type-to-sign" className={styles.btnPrimary}>
            <span>Start communicating</span>
            <svg className={styles.btnArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </Link>
          <a href="#how-it-works" className={styles.btnSecondary}>
            See how it works
          </a>
        </div>

        <div className={`${styles.trust} ${stagger('delay5')}`}>
          <span className={styles.trustDot}>🟠</span>
          <span>Real-time</span>
          <span className={styles.trustSep}>·</span>
          <span>Runs in your browser</span>
          <span className={styles.trustSep}>·</span>
          <span>No sign-up</span>
        </div>
      </div>

      <div className={styles.chevron}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 13l5 5 5-5M7 6l5 5 5-5"/>
        </svg>
      </div>
    </section>
  );
}
