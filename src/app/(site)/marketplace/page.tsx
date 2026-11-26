import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { Container } from "@/components/ui/primitives";
import { MarketplaceBrowser } from "@/components/marketplace/browser";
import { listCategories, listServices } from "@/lib/catalog";

export const metadata: Metadata = { title: "Marketplace", description: "Fixed-scope commercialization products with starting prices, scopes and timelines." };
export const dynamic = "force-dynamic";

export default async function MarketplacePage({ searchParams }: PageProps<"/marketplace">) {
  const sp = await searchParams;
  const [services, categories] = await Promise.all([listServices(), listCategories()]);
  const published = services.filter((s) => s.is_published);
  const recommended = typeof sp.recommended === "string" ? sp.recommended.split(",").filter((s) => published.some((p) => p.slug === s)).slice(0, 6) : [];
  return (
    <>
      <PageHeader eyebrow="Marketplace" title="Commercialization products with a clear price, a clear date and a clear finish line." intro="Browse by stage, deliverable or budget. Compare scopes side by side and build a shortlist for a proposal. Prices are starting prices; final scope is confirmed in a written proposal." />
      <Container className="py-12"><MarketplaceBrowser services={published} categories={categories} recommended={recommended} /></Container>
    </>
  );
}
