import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getLocale, dictionary } from "@/lib/i18n";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnchorBehavior } from "@/components/shared/anchor-behavior";
import { manrope } from "@/lib/fonts";
import { siteOrigin } from "@/lib/deployment";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  icons: { icon: "/assets/mascot.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e7f4ff",
};
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={manrope.variable}>
      <body>
        <a className="skip-link" href="#main">
          {dictionary(locale)["a11y.skip"]}
        </a>
        <Header locale={locale} />
        {children}
        <Footer locale={locale} />
        <AnchorBehavior />
      </body>
    </html>
  );
}
