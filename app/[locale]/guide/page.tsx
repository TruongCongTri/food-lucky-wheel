import { legalMetadata, renderLegal } from "../legal";

export async function generateMetadata({ params }: PageProps<"/[locale]/guide">) {
  return legalMetadata((await params).locale, "guide");
}

export default async function GuidePage({ params }: PageProps<"/[locale]/guide">) {
  return renderLegal((await params).locale, "guide");
}
