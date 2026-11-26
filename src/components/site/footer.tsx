import Link from "next/link";
import { Logo } from "../brand/logo";
import { site } from "@/content/site";

const groups = [
  { title: "Method", links: [["/method", "Position · Build · Activate"], ["/services/position", "Position"], ["/services/build", "Build"], ["/services/activate", "Activate"]] },
  { title: "Work with us", links: [["/marketplace", "Marketplace"], ["/pricing", "Pricing"], ["/assessment", "Readiness assessment"], ["/apply", "Apply"]] },
  { title: "Company", links: [["/about", "About"], ["/industries", "Industries"], ["/insights", "Insights"], ["/contact", "Contact"]] },
  { title: "Legal", links: [["/privacy", "Privacy"], ["/terms", "Terms"]] },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-carbon">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo variant="lockup-ivory" width={132} />
          <p className="label mt-6 text-gold">{site.tagline}</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="label text-ivory-70">{g.title}</p>
              <ul className="mt-4 space-y-2.5">
                {g.links.map(([href, label]) => (
                  <li key={href}><Link href={href!} className="text-caption text-ivory hover:text-gold-light">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-3 px-5 py-6 text-caption text-ivory-70 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl">{site.disclaimer}</p>
          <p className="label">© {new Date().getFullYear()} Trident</p>
        </div>
      </div>
    </footer>
  );
}
