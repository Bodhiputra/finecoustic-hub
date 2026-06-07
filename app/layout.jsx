import './globals.css';

export const metadata = {
  title: 'Finecoustic — Operations',
  description: 'Internal operations hub — inventory, B2B customers, and dashboard',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
