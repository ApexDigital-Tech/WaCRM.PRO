import React from 'react';
import './globals.css';

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
      <body>
        {children}
      </body>
    </html>
  );
}
