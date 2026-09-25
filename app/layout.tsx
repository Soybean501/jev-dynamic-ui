import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jev Playground — tiny decisions, big possibilities',
  description: 'Explore Jev, the System One decision model, with interactive examples.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
