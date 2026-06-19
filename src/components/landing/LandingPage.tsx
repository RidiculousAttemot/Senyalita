'use client';

import LandingNav from './LandingNav';
import HeroSection from './HeroSection';
import HowItWorks from './HowItWorks';
import FeatureCards from './FeatureCards';
import LandingFooter from './LandingFooter';
import styles from './LandingPage.module.css';

export default function LandingPage() {
  return (
    <div className={styles.landingPage}>
      <div className={styles.content}>
        <LandingNav />
        <HeroSection />
        <HowItWorks />
        <FeatureCards />
        <LandingFooter />
      </div>
    </div>
  );
}
