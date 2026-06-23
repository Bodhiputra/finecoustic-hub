import localFont from 'next/font/local';
import './globals.css';
import Providers from '@/components/Providers';

const alteHaas = localFont({
  src: [
    { path: '../public/fonts/AlteHaasGroteskRegular.ttf', weight: '400', style: 'normal' },
    { path: '../public/fonts/AlteHaasGroteskBold.ttf', weight: '700', style: 'normal' },
  ],
  display: 'swap',
});

export const metadata = {
  title: 'Fine Hub',
  description: 'Internal workspace — operations, knowledge, and project tools',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={alteHaas.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
