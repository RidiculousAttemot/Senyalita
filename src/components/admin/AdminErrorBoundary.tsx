'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '24px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <AlertTriangle size={20} style={{ color: '#b91c1c', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ margin: '0 0 8px', color: '#991b1b', fontWeight: 600 }}>Error loading dashboard</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
              {this.state.error?.message || 'An unexpected error occurred. Please try refreshing the page.'}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
