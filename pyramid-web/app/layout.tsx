import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Piramida Tirana · Event Manager",
  description: "Interactive 3D event manager for the Pyramid of Tirana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
