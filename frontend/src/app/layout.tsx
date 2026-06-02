// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export const viewport = {
  themeColor: '#0b0e13',
};

export const metadata: Metadata = {
  title: {
    default: 'SJC Result Hub',
    template: '%s | SJC Result Hub',
  },
  description:
    'Student result analysis, SGPA tracking, and academic insights for St. Joseph\'s College.',
  keywords: ['SJC', 'St. Joseph\'s College', 'student results', 'SGPA', 'academic analytics'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}