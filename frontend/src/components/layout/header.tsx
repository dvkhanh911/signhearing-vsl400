import Image from "next/image";
import { headers } from "next/headers";
import { dictionary, localized, type Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { LanguageSwitch } from "./language-switch";
import { MobileNavigation } from "./mobile-navigation";
import { SessionLink } from "./session-link";

export async function Header({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const page = (await headers()).get("x-sh-page");
  const path = page === "/" || page === "/features" ? page : "/404";
  const links = [
    ["vsl", "nav.vsl"],
    ["cau-chuyen", "nav.story"],
    ["hanh-trinh", "nav.journey"],
    ["dong-hanh", "nav.together"],
  ].map(([id, key]) => ({
    href: localized(`/#${id}`, locale),
    label: t[key as keyof typeof t],
  }));
  links.splice(2, 0, {
    href: localized("/features", locale),
    label: t["nav.features"],
  });
  const language = {
    path,
    label: t["a11y.language"],
    viLabel: t["a11y.vi"],
    enLabel: t["a11y.en"],
  };
  return (
    <header
      className={`site-header${path === "/features" ? " sh-features-header" : ""}`}
    >
      <div className="shell header-inner">
        <a
          href={localized("/", locale)}
          aria-label={t["a11y.home"]}
          className="brand"
        >
          <Image
            src="/assets/logo-horizontal.png"
            alt={t["site.name"]}
            width={2172}
            height={724}
            priority
            sizes="200px"
          />
        </a>
        <nav className="desktop-navigation" aria-label={t["a11y.navigation"]}>
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={
                path === "/features" && link.href.startsWith("/features?")
                  ? "page"
                  : undefined
              }
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="header-tools">
          <LanguageSwitch locale={locale} {...language} />
          <Button asChild className="header-cta">
            <SessionLink locale={locale} label={t["action.explore"]} />
          </Button>
        </div>
        <MobileNavigation
          links={links}
          menuLabel={t["nav.menu"]}
          navigationLabel={t["a11y.navigation"]}
          exploreLabel={t["action.explore"]}
          appUrl={localized("/app", locale)}
          locale={locale}
          language={language}
        />
      </div>
      <noscript>
        <nav
          className="shell mobile-noscript"
          aria-label={t["a11y.navigation"]}
        >
          {links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <a
            href={`${path}?lang=vi`}
            lang="vi"
            hrefLang="vi"
            aria-label={t["a11y.vi"]}
          >
            VI
          </a>
          <a
            href={`${path}?lang=en`}
            lang="en"
            hrefLang="en"
            aria-label={t["a11y.en"]}
          >
            EN
          </a>
        </nav>
      </noscript>
    </header>
  );
}
