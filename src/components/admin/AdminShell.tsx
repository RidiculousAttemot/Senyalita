'use client';

import { useState } from 'react';
import { Menu, ShieldAlert, ShieldCheck } from 'lucide-react';
import AdminSidebar from './AdminSidebar';

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
              <span className="admin-console-workspace-context">AI management console</span>
            </div>
            <div className={`admin-console-auth ${isAuthenticated ? 'is-authenticated' : 'is-locked'}`}>
              {isAuthenticated ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
              <span>{isAuthenticated ? 'Authenticated' : 'Locked'}</span>
              {email && <span className="admin-console-email">{email}</span>}
            </div>
          </div>
        </header>
        <main id="main-content" className="admin-console-content">
          {/*
            Two facts that are not visible from inside the console, and that
            each caused real confusion.

            The console is not part of the deployed site: it exists only where
            ADMIN_ENABLED is set, and every admin path 404s otherwise. Someone
            looking for it on the live URL will not find it and should not
            conclude it is broken.

            What it changes IS live. Published assets are written to Supabase,
            which the deployed site reads directly — so publishing from
            localhost updates production immediately, with no deploy. That is
            the surprising direction, and it belongs on screen rather than in a
            comment in the availability module.
          */}
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