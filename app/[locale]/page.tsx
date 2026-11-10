import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { listActiveDishes } from "@/lib/dishes/store";
import { HomeExperience } from "@/components/HomeExperience/HomeExperience";
import { WheelSkeleton } from "@/components/WheelSkeleton/WheelSkeleton";
import { Steps } from "@/components/Steps/Steps";
import { Footer } from "@/components/Footer/Footer";
import styles from "./page.module.css";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <main className={styles.main}>
      <Suspense fallback={<WheelSkeleton label={dict.wheel.loading} />}>
        <Wheel />
      </Suspense>
      <Steps t={dict.steps} />
      <Footer t={dict.footer} locale={locale} />
    </main>
  );
}

/** Dishes are read per request so management changes show up immediately. */
async function Wheel() {
  await connection();
  const dishes = await listActiveDishes();
  return <HomeExperience initialDishes={dishes} />;
}
