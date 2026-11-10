import { ConsentControl } from "@/components/ConsentControl/ConsentControl";
import { legalMetadata, renderLegal } from "../legal";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">) {
  return legalMetadata((await params).locale, "privacy");
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  return renderLegal((await params).locale, "privacy", (legal, locale) => {
    const control = <ConsentControl locale={locale} labels={legal.common} />;
    // The withdraw control lives in the "withdraw consent" section (vi / en ids).
    return { "rut-dong-y": control, withdraw: control };
  });
}
