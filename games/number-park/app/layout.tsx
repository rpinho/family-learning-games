import type { Metadata } from 'next';
import './globals.css';
import './calm.css';


export const metadata: Metadata = {
  title: 'Number Park — Family math adventures',
  description: 'Beginner’s small-number play and Explorer’s multiplication and number challenges, with separate progress.',
  manifest:'/manifest.webmanifest',
  icons:{icon:[{url:'/icons/number-park-32.png',sizes:'32x32',type:'image/png'}],apple:'/icons/number-park-180.png'},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
