import { ConsentSettingsButton } from "@/components/ConsentBanner/ConsentSettingsButton";
import { legalMetadata, renderLegal } from "../legal";
import styles from "../legal.module.css";

export async function generateMetadata({ params }: PageProps<"/[locale]/cookies">) {
  return legalMetadata((await params).locale, "cookies");
}

export default async function CookiesPage({ params }: PageProps<"/[locale]/cookies">) {
  return renderLegal((await params).locale, "cookies", (legal) => {
    const button = <ConsentSettingsButton label={legal.common.cookieSettings} className={styles.settings} />;
    // The settings button lives in the "change your choices" section (vi / en ids).
    return { "quan-ly": button, manage: button };
  });
}
