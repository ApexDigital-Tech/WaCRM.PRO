import React from 'react';

export const metadata = {
  title: 'WA-CRM SaaS',
  description: 'Panel de administración de WA-CRM',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
