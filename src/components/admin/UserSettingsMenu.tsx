'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut, Settings, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

type UserSettingsMenuProps = {
  email: string | null;
};

export default function UserSettingsMenu({ email }: UserSettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="admin-user-settings-menu" ref={menuRef}>
      <button
        type="button"
        className="admin-user-settings-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User settings"
        aria-expanded={isOpen}
      >
        <ShieldCheck size={16} />
        <span className="admin-user-email-label">
          {email ? email.split('@')[0] : 'User'}
        </span>
      </button>

      {isOpen && (
        <div className="admin-user-settings-dropdown">
          <div className="admin-user-settings-header">
            {email && (
              <>
                <div className="admin-user-settings-email">{email}</div>
              </>
            )}
          </div>

          <div className="admin-user-settings-divider" />

          <Link
            href="/admin/logout"
            className="admin-user-settings-item admin-user-settings-logout"
            onClick={() => setIsOpen(false)}
          >
            <LogOut size={16} />
            <span>Log out</span>
          </Link>
        </div>
      )}
    </div>
  );
}
