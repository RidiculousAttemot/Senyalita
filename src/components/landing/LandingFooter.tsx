'use client';

import useInView from '../../hooks/useInView';
import styles from './LandingFooter.module.css';

export default function LandingFooter() {
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.3 });

  return (
    <footer className={`${styles.footer} ${inView ? styles.visible : ''}`} ref={ref}>
      <p>SIGNWITHUS — Thesis Project</p>
      <p className={styles.sub}>Built with open-source pose estimation · Hand tracking runs locally</p>
    </footer>
  );
}
