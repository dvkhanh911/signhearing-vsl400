import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dictionary, getLocale, localized } from "@/lib/i18n";

export async function learningUnavailableMetadata() {
  const t = dictionary(await getLocale());
  return {
    title: t["availability.learning.title"],
    description: t["availability.learning.body"],
    robots: { index: false, follow: false },
  };
}

export async function LearningUnavailable() {
  const locale = await getLocale();
  const t = dictionary(locale);
  return (
    <main
      id="main"
      className="state-page shell"
      aria-labelledby="learning-unavailable-title"
    >
      <Image
        src="/assets/mascot.png"
        width={1351}
        height={1164}
        sizes="220px"
        alt={t["a11y.mascot"]}
        priority
      />
      <h1 id="learning-unavailable-title">
        {t["availability.learning.title"]}
      </h1>
      <p>{t["availability.learning.body"]}</p>
      <Button asChild>
        <a href={localized("/features", locale)}>
          <ArrowLeft aria-hidden="true" />
          {t["availability.learning.action"]}
        </a>
      </Button>
    </main>
  );
}
