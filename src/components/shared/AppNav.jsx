import { Link, NavLink } from 'react-router-dom';
import styles from './AppNav.module.css';

const KeyboardIcon = () => (
  <svg viewBox="0 0 24 24">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M6 16h12" />
  </svg>
);

const CameraIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const VideoCamIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M15 10l4.5-3v10L15 14M3 6h10a2 2 0 012 2v8a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2z" />
  </svg>
);

export default function AppNav({ activePage, showCameraBtn, onCameraToggle, cameraActive }) {
  return (
    <nav className={styles.nav}>
      <div className={styles.left}>
        <Link to="/" className={styles.homeLink}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Home
        </Link>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandIcon}>
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </span>
          <span className={styles.brandName}>SIGNWITHUS</span>
        </Link>
      </div>

      <div className={styles.center}>
        <div className={styles.tabPill}>
          <NavLink
            to="/type-to-sign"
            className={({ isActive }) =>
              `${styles.tab} ${isActive ? styles.tabActive : ''}`
            }
          >
            <KeyboardIcon />
            Type → Sign
          </NavLink>
          <NavLink
            to="/sign-to-text"
            className={({ isActive }) =>
              `${styles.tab} ${isActive ? styles.tabActive : ''}`
            }
          >
            <CameraIcon />
            Sign → Text
          </NavLink>
        </div>
      </div>

      <div className={styles.right}>
        {showCameraBtn && (
          <button
            className={`${styles.cameraBtn} ${cameraActive ? styles.cameraBtnActive : ''}`}
            onClick={onCameraToggle}
          >
            <VideoCamIcon />
            {cameraActive ? 'Stop camera' : 'Start camera'}
          </button>
        )}
      </div>
    </nav>
  );
}
