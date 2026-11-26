import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { DevBanner } from "@/components/site/dev-banner";
import { currentUser } from "@/lib/auth";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <>
      <DevBanner />
      <Header signedIn={!!user} />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
