import { DevBanner } from "@/components/site/dev-banner";
import { AppHeader } from "@/components/app/app-header";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  // Pages call requireUser() with their own path so sign-in returns the user to the right place.
  if (!user) return <main id="main">{children}</main>;
  const links = [{ href: "/portal", label: "Overview" }, { href: "/portal/settings", label: "Settings" }, ...(user.isStaff ? [{ href: "/command", label: "Trident Command" }] : [])];
  return (
    <>
      <DevBanner />
      <AppHeader email={user.email} area="Client portal" links={links} />
      <main id="main" className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8">{children}</main>
    </>
  );
}
