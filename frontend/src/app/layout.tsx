import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MRU Dashboard - University ERP",
  description: "Modern University ERP Dashboard for managing students, courses, and faculty",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-zinc-50 dark:bg-zinc-950">
        {children}
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: "white",
              border: "1px solid #e4e4e7",
              borderRadius: "12px",
            },
          }}
        />
      </body>
    </html>
  );
}
