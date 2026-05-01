import type { Metadata } from 'next';
import { Fraunces, Outfit } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "don't let it die",
  description: "one fire for the internet. keep it alive.",
  openGraph: {
    title: "don't let it die",
    description: "the internet has been keeping this fire alive. don't let it die.",
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${outfit.variable}`}>
      <body style={{ fontFamily: 'var(--font-outfit), sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
