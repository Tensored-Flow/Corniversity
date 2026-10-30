import "@fontsource-variable/fraunces";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Corniversity", template: "%s · Corniversity" },
  description: "A private, independent personal university.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#16140f" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const theme = jar.get("corniversity-theme")?.value === "dark" ? "dark" : "light";
  const scale = Number(jar.get("corniversity-font-scale")?.value ?? "1");
  const fontScale = Number.isFinite(scale) && scale >= 0.875 && scale <= 1.5 ? scale : 1;
  return (
    <html lang="en" data-theme={theme} style={{ ["--font-scale" as string]: String(fontScale) }}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
