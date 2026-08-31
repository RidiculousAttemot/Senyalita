'use client';

import { useState } from 'react';
import { Menu, ShieldAlert, ShieldCheck } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import UserSettingsMenu from './UserSettingsMenu';

type AdminShellProps = {
  children: React.ReactNode;
  isAuthenticated: boolean;
  email: string | null;
};

export default function AdminShell({ children, isAuthenticated, email }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="admin-console">
      <AdminSidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />
      <div className="admin-console-main">
        <header className="admin-console-topbar">
          <div className="admin-console-topbar-inner">
            <button
              type="button"
              className="admin-console-menu-button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="admin-console-workspace">
              <span className="admin-console-workspace-name">Senyalita Admin</span>
              <span className="admin-console-workspace-context">Animation pipeline management</span>
            </div>
            <div className={`admin-console-auth ${isAuthenticated ? 'is-authenticated' : 'is-locked'}`}>
              {isAuthenticated ? (
                <UserSettingsMenu email={email} />
              ) : (
                <>
                  <ShieldAlert size={16} />
                  <span>Locked</span>
                </>
              )}
            </div>
          </div>
        </header>
        <main id="main-content" className="admin-console-content">
          <p className="admin-console-scope-note">
            <ShieldCheck size={14} aria-hidden />
            <span>
              This console runs locally and is not part of the deployed site.
              Publishing writes to the shared database, so changes go live immediately.
            </span>
          </p>
          {children}
        </main>
      </div>
    </div>
  );
}