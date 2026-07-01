'use client';

/**
 * Bank-connection page, opened from the mobile app in the system browser.
 * The app passes the API secret in the URL hash (never sent to the server or
 * logged): https://<api>/link#s=<APP_SECRET>
 *
 * Flow: create link token → open Plaid Link → exchange public token → done.
 */
import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Plaid?: {
      create: (config: {
        token: string;
        onSuccess: (publicToken: string) => void;
        onExit: (err: unknown) => void;
      }) => { open: () => void };
    };
  }
}

type Status = 'loading' | 'ready' | 'connecting' | 'success' | 'error';

export default function LinkPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Preparing bank connection…');
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [secret, setSecret] = useState('');

  useEffect(() => {
    const hashSecret = new URLSearchParams(window.location.hash.slice(1)).get('s') || '';
    if (!hashSecret) {
      setStatus('error');
      setMessage('Missing secret. Open this page from the Fynance app.');
      return;
    }
    setSecret(hashSecret);

    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.onload = () => createToken(hashSecret);
    script.onerror = () => {
      setStatus('error');
      setMessage('Could not load Plaid. Check your internet connection.');
    };
    document.body.appendChild(script);
  }, []);

  async function createToken(hashSecret: string) {
    try {
      const res = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${hashSecret}` },
      });
      if (!res.ok) throw new Error(res.status === 401 ? 'Invalid secret' : 'Failed to create link token');
      const data = await res.json();
      setLinkToken(data.link_token);
      setStatus('ready');
      setMessage('Ready to connect your bank.');
    } catch (e: any) {
      setStatus('error');
      setMessage(e.message || 'Failed to initialize');
    }
  }

  function openLink() {
    if (!window.Plaid || !linkToken) return;
    setStatus('connecting');
    setMessage('Opening Plaid Link…');

    const handler = window.Plaid.create({
      token: linkToken,
      onSuccess: async (publicToken: string) => {
        setMessage('Saving connection…');
        try {
          const res = await fetch('/api/plaid/exchange-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify({ public_token: publicToken }),
          });
          if (!res.ok) throw new Error('Exchange failed');
          setStatus('success');
          setMessage('Bank connected! Head back to the app and pull to refresh.');
        } catch {
          setStatus('error');
          setMessage('Bank linked in Plaid but saving failed. Try again.');
        }
      },
      onExit: () => {
        setStatus('ready');
        setMessage('Connection cancelled. You can try again.');
      },
    });
    handler.open();
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>Fynance</div>
        <h1 style={styles.title}>Connect a Bank</h1>
        <p style={{ ...styles.message, color: status === 'error' ? '#EF4444' : status === 'success' ? '#10B981' : '#9CA3AF' }}>
          {message}
        </p>
        {status === 'ready' && (
          <button style={styles.button} onClick={openLink}>
            Open Plaid Link
          </button>
        )}
        {status === 'success' && <div style={styles.check}>✓</div>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1A1A24',
    border: '1px solid #2A2A35',
    borderRadius: 16,
    padding: 32,
    maxWidth: 400,
    width: '100%',
    textAlign: 'center',
  },
  logo: {
    color: '#10B981',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    margin: '0 0 12px',
  },
  message: {
    fontSize: 15,
    lineHeight: 1.5,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 12,
    padding: '14px 28px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
  check: {
    fontSize: 48,
    color: '#10B981',
  },
};
