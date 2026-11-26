import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { HeroLab } from "./lab";

export const metadata = { title: "Hero lab", robots: { index: false, follow: false } };

/** Development only: compare the four hero presets with identical nav, copy and type. 404 in production. */
export default async function HeroLabPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (env().APP_ENV === "production" || process.env.NODE_ENV === "production") notFound();
  const sp = await props.searchParams;
  const preset = typeof sp.preset === "string" ? sp.preset : undefined;
  return <HeroLab initial={preset} />;
}
