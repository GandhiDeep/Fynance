import type { ReactNode } from 'react';

export const metadata = {
  title: 'Fynance',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: '#0A0A0F', color: '#FFFFFF', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
