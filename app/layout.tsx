import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { DeductionModal } from "@/components/deduction-modal";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "3D Hub",
  description: "Control center for Bambu Lab A1 Mini",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-56 p-8 max-w-screen-xl">{children}</main>
        <DeductionModal />
      </body>
    </html>
  );
}
