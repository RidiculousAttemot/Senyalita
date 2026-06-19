'use client';

import Link from 'next/link';
import useInView from '../../hooks/useInView';
import styles from './FeatureCards.module.css';

const KeyboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M6 16h12" />
  </svg>
);

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

interface Card {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  to: string;
}

const cards: Card[] = [
  {
    icon: <KeyboardIcon />,
    title: 'Type → Sign',
    desc: 'Type any message and a signing avatar performs it live.',
    cta: 'Start Typing →',
    to: '/translate'
  },
  {
    icon: <CameraIcon />,
    title: 'Sign → Text',
    desc: 'Fingerspell to the camera — your signs become text and speech.',
    cta: 'Open Camera →',
    to: '/conversation'
  }
];

export default function FeatureCards() {
  const [sectionRef, inView] = useInView<HTMLElement>({ threshold: 0.2 });

  return (
    <section className={styles.section} ref={sectionRef}>
      <div className={styles.inner}>
        {cards.map((card, i) => (
          <div
            className={`${styles.card} ${inView ? styles.cardVisible : ''}`}
            key={card.title}
            style={{ transitionDelay: `${i * 0.15}s` }}
          >
            <div className={styles.iconWrap}>
              <div className={styles.iconBg}>{card.icon}</div>
            </div>
            <h3 className={styles.cardTitle}>{card.title}</h3>
            <p className={styles.cardDesc}>{card.desc}</p>
            <Link href={card.to} className={styles.cta}>
              <span>{card.cta}</span>
              <svg className={styles.ctaArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
