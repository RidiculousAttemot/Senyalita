'use client';

import Link from 'next/link';

interface ToolLinkProps {
  href: string;
  label: string;
  color: string;
}

export default function ToolLink({ href, label, color }: ToolLinkProps) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        color,
        textDecoration: 'none',
        borderRadius: '6px',
        fontSize: '0.9rem',
        fontWeight: 500,
        transition: 'background-color 0.15s',
      }}
      onMouseOver={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.backgroundColor = '#f1f5f9';
      }}
      onMouseOut={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.backgroundColor = 'transparent';
      }}
    >
      <span>→</span>
      <span style={{ marginLeft: '8px' }}>{label}</span>
    </Link>
  );
}
