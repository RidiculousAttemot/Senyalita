'use client';

import React from 'react';
import useInView from '../../hooks/useInView';
import styles from './HowItWorks.module.css';

interface Step {
  num: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}

const steps: Step[] = [
  {
    num: '01',
    title: 'Choose your role',
    desc: 'Hearing partner or Deaf signer — both are welcome.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="20" cy="14" r="6" />
        <path d="M10 32c0-5.523 4.477-10 10-10s10 4.477 10 10" />
      </svg>
    )
  },
  {
    num: '02',
    title: 'Type or fingerspell',
    desc: 'Type English text or sign letters A–Z with your camera.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="6" y="10" width="28" height="20" rx="2" />
        <path d="M12 16h16M12 21h12M12 26h8" />
      </svg>
    )
  },
  {
    num: '03',
    title: 'Communicate in real time',
    desc: 'Avatar signs back. Camera reads signs. No lag, no login.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="20" cy="20" r="14" />
        <path d="M20 12v8l6 4" />
      </svg>
    )
  }
];

export default function HowItWorks() {
  const [sectionRef, inView] = useInView<HTMLElement>({ threshold: 0.2 });

  return (
    <section id="how-it-works" className={styles.section} ref={sectionRef}>
      <h2 className={`${styles.title} ${inView ? styles.titleVisible : ''}`}>
        How it works
      </h2>
      <div className={styles.steps}>
        {steps.map((step, i) => (
          <React.Fragment key={step.num}>
            {i > 0 && (
              <div
                className={`${styles.divider} ${inView ? styles.dividerVisible : ''}`}
                style={{ transitionDelay: `${0.4 + i * 0.15}s` }}
                aria-hidden="true"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 5l7 7-7 7"/>
                </svg>
              </div>
            )}
            <div
              className={`${styles.step} ${inView ? styles.stepVisible : ''}`}
              style={{ transitionDelay: `${0.2 + i * 0.15}s` }}
            >
              <div className={styles.stepIcon}>{step.icon}</div>
              <div className={styles.number}>{step.num}</div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.desc}>{step.desc}</p>
            </div>
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
