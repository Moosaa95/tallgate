import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { twMerge } from "tailwind-merge";

const dmSans = DM_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TALLGATE COMPUTING Enterprise",
  description: "Empowering your journey in computing with comprehensive training and resources.",
  keywords: "computing, training, technology, courses, programming, development",
  authors: [{name:"Musa Abdullahi", url:""}],
  viewport: "width=device-width, initial-scale=1.0",
  robots: "index, follow",
  openGraph: {
    type: "website",
    url: "https://yourdomain.com",
    title: "TALLGATE COMPUTING Enterprise",
    description: "Empowering your journey in computing with comprehensive training and resources.",
    images: [
      {
        url: "https://yourdomain.com/og-image.jpg",
        width: 800,
        height: 600,
        alt: "TALLGATE COMPUTING Enterprise",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@tallgate01",
    title: "TALLGATE COMPUTING Enterprise",
    description: "Empowering your journey in computing with comprehensive training and resources.",
    images: ["https://yourdomain.com/og-image.jpg"],
  },
  

};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={twMerge(dmSans.className, 'antialiased bg-[#EAEEFE]')}>{children}</body>
    </html>
  );
}
