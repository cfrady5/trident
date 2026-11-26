/**
 * Centralized public-site content. Voice rules: VOICE.md (sentence case, no
 * exclamation marks, no serial comma, numerals for data, acronyms spelled out
 * on first use, exact status language).
 *
 * PROVISIONAL (brand guide p.2/p.32 gate): every use of "independent" and
 * "not affiliated" is provisional until the employer conflict-of-interest and
 * outside-activity review is cleared. Nothing here should be published before
 * that gate clears. See BRAND.md -> Open decisions.
 */

export const site = {
  name: "Trident",
  descriptor: "Technology commercialization & creative agency",
  tagline: "Beyond the Award.",
  secondary: "Government-validated. Market-ready.",
  promise: "Turning breakthrough technology into market opportunity.",
  oneLine: "Trident turns government-validated technology into commercial market opportunity.",
  disclaimer:
    "Trident is an independent company. It is not affiliated with, endorsed by or acting on behalf of any government agency or program.",
};

export const nav = [
  { href: "/method", label: "Method" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/pricing", label: "Pricing" },
  { href: "/industries", label: "Industries" },
  { href: "/insights", label: "Insights" },
  { href: "/about", label: "About" },
];

export interface PillarContent {
  key: "position" | "build" | "activate";
  number: string;
  name: string;
  line: string;
  question: string;
  problem: string;
  services: string[];
  deliverables: string[];
  output: string;
  intro: string;
  serviceSlugs: string[];
}

export const pillars: PillarContent[] = [
  {
    key: "position",
    number: "01",
    name: "Position",
    line: "Define the opportunity.",
    question: "Who buys this and why?",
    problem: "Most award-stage companies describe their technology to reviewers, not buyers. Commercial customers can't tell who it's for or why it matters to them.",
    intro: "Position defines the commercial opportunity beyond the program that funded the work: the buyer, the problem they pay to solve and the proof that you solve it.",
    services: ["Buyer and market mapping beyond the funding program", "Competitive landscape and white space", "Positioning statement and value proposition", "Messaging house and proof points"],
    deliverables: ["Positioning brief", "Messaging house", "Pitch narrative"],
    output: "Positioning brief + messaging house",
    serviceSlugs: ["position-sprint", "commercial-readiness-audit", "marketplace-pitch-development"],
  },
  {
    key: "build",
    number: "02",
    name: "Build",
    line: "Establish the presence.",
    question: "Will they believe us?",
    problem: "Buyers who look you up find an outdated site, a deck built for a review panel and no consistent identity. Credibility is lost before the first call.",
    intro: "Build turns the positioning into a launch-ready brand system and the assets a buyer, partner or investor actually sees.",
    services: ["Brand identity and brand kit", "Website and landing pages", "Pitch and capability decks, one-pagers", "Social, email and document templates"],
    deliverables: ["Brand kit", "Website", "Decks and documents", "Blank templates"],
    output: "Launch-ready brand system and assets",
    serviceSlugs: ["complete-brand-identity", "startup-website", "investor-pitch-deck", "build-kit"],
  },
  {
    key: "activate",
    number: "03",
    name: "Activate",
    line: "Generate demand.",
    question: "Will they act?",
    problem: "Even a strong brand stays invisible without a steady, credible presence in the channels buyers use.",
    intro: "Activate generates demand through thought leadership, launch campaigns and events, measured every month.",
    services: ["LinkedIn and thought-leadership program", "Launch and announcement campaigns", "Event and outreach materials", "Monthly measurement and iteration"],
    deliverables: ["90-day activation plan", "Content calendar", "Campaign assets", "Monthly report"],
    output: "90-day activation plan + content calendar",
    serviceSlugs: ["90-day-activate-program", "social-media-template-system", "conference-readiness-package"],
  },
];

export const audiences = [
  { number: "01", name: "Award-stage companies", who: "Small Business Innovation Research (SBIR) and Small Business Technology Transfer (STTR) awardees, marketplace-awardable vendors, lab and university spinouts.", need: "A commercial story, a credible presence and a pipeline beyond the program that funded them.", gives: "Positioning, a launch-ready brand and a demand program." },
  { number: "02", name: "Pre-award founders", who: "Teams preparing for a competitive selection or marketplace pitch.", need: "A clear, confident way to explain the technology and its value in minutes.", gives: "Messaging, pitch decks and pitch-video scripts and visuals." },
  { number: "03", name: "Referrers", who: "Accelerators, innovation hubs, tech-transfer offices and investors.", need: "Confidence that the companies they back will present well and convert attention.", gives: "A dependable partner with fixed scopes and a visible quality standard." },
];

export const qualitySteps = [
  { n: "01", name: "Make", text: "Built from the brand system and templates" },
  { n: "02", name: "Render", text: "Exported in the real format, at real size" },
  { n: "03", name: "Review", text: "Every page or screen checked against the guide" },
  { n: "04", name: "Fix", text: "Loop back until nothing is flagged" },
  { n: "05", name: "Ship", text: "With a delivery note" },
];

export const engagementModels = [
  { name: "Fixed-scope projects", price: "From $500", text: "One deliverable or one prong, with a clear price, a clear date and a clear finish line.", href: "/marketplace" },
  { name: "Recurring retainers", price: "From $1,500 a month", text: "Defined monthly allowances for content, campaigns and collateral. Never unlimited, always reported.", href: "/pricing" },
  { name: "Commercialization programs", price: "From $18,500", text: "Position, Build and Activate in sequence, managed as one program with one roadmap.", href: "/marketplace/beyond-the-award" },
];

export interface Industry {
  slug: string;
  name: string;
  headline: string;
  intro: string;
  buyers: string[];
  gaps: string[];
  serviceSlugs: string[];
}

export const industries: Industry[] = [
  {
    slug: "defense",
    name: "Defense",
    headline: "Dual-use from the first sentence.",
    intro: "Defense technology companies often earn their first validation from a program office. The commercial market reads the same technology very differently: it needs the operator problem, the business case and proof that the product is available to buy.",
    buyers: ["Defense programs and program offices", "Prime contractors and integrators", "Commercial operators in adjacent markets", "Investors focused on dual-use technology"],
    gaps: ["Messaging written for proposal reviewers rather than operators or commercial buyers", "Credentials stated loosely, for example selection described as a contract", "Websites that cannot show capability without sharing restricted detail"],
    serviceSlugs: ["position-sprint", "capability-statement", "marketplace-pitch-development"],
  },
  {
    slug: "aerospace",
    name: "Aerospace",
    headline: "From test campaign to customer conversation.",
    intro: "Aerospace and space companies sell long-cycle, high-consequence technology to a small number of sophisticated buyers. Presence has to carry technical credibility and commercial clarity at the same time.",
    buyers: ["Satellite and launch operators", "Aerospace primes and tier suppliers", "Civil and defense space programs", "Strategic investors"],
    gaps: ["Technical depth with no clear buyer or use case on the page", "Milestones announced once and never reused", "No consistent identity across decks, documents and events"],
    serviceSlugs: ["complete-brand-identity", "corporate-website", "conference-readiness-package"],
  },
  {
    slug: "advanced-manufacturing",
    name: "Advanced manufacturing",
    headline: "Show the process, prove the outcome.",
    intro: "Advanced manufacturing companies need buyers to understand a process advantage quickly: throughput, quality, cost or materials that were not possible before. The story has to translate engineering results into operational value.",
    buyers: ["Manufacturers and plant leadership", "Supply chain and sourcing teams", "Defense industrial base programs", "Industrial investors"],
    gaps: ["Results described in lab terms instead of operational outcomes", "No product sheets a sourcing team can circulate", "Little visible activity between trade shows"],
    serviceSlugs: ["product-one-pager", "startup-website", "90-day-activate-program"],
  },
  {
    slug: "emerging-technology",
    name: "Emerging technology",
    headline: "New categories need a clear first buyer.",
    intro: "Companies building in new categories, from advanced materials to applied AI and quantum, face an extra step: buyers first need to understand the category before they can choose a vendor.",
    buyers: ["Early-adopter enterprises", "Research institutions and labs", "Government innovation programs", "Venture investors"],
    gaps: ["Category explained but company not positioned within it", "Pitch built for investors, reused unchanged for customers", "No thought leadership to establish a point of view"],
    serviceSlugs: ["position-sprint", "investor-pitch-deck", "90-day-activate-program"],
  },
];

export interface Insight {
  slug: string;
  title: string;
  summary: string;
  published: string; // ISO date
  readingMinutes: number;
  body: { type: "p" | "h2" | "ul" | "source"; text?: string; items?: string[] }[];
}

/**
 * Figures below are quoted from the sources the brand guide (v2.1, p.6-7, p.33)
 * re-read on Nov 23, 2026. Refresh yearly. They describe the pool Trident sells
 * into; none implies a relationship with any program.
 */
export const insights: Insight[] = [
  {
    slug: "awardable-is-not-adopted",
    title: "Awardable is not the same as adopted",
    summary: "An award proves the technology works. It does not build a brand, a buyer pipeline or a story a commercial customer understands.",
    published: "2026-11-24",
    readingMinutes: 4,
    body: [
      { type: "p", text: "Every year, small technology companies win competitive government innovation awards and earn awardable status on government marketplaces. Each is a demanding, competitive selection. Each proves that a technology is credible." },
      { type: "p", text: "The scale is significant. In fiscal year 2024, federal agencies made 6,444 Small Business Innovation Research (SBIR) and Small Business Technology Transfer (STTR) awards worth $4.35B across 11 agencies, according to the Government Accountability Office (GAO)." },
      { type: "h2", text: "What the public data measures" },
      { type: "p", text: "No public dataset we found measures commercial adoption directly. What is measured is government transition and private financing, and those measures are narrow:" },
      { type: "ul", items: [
        "16% of Department of Defense (DoD) SBIR companies won a Phase III award over a decade (748 of 4,703, fiscal years 2012 to 2021). This is a narrow measure of government transition.",
        "58% to 63% show some transition activity when every later DoD contract or subcontract is counted, a much wider measure.",
        "18% of DoD SBIR/STTR awardees reported at least one outside financing round between 2012 and 2020, likely an undercount because only announced deals are captured.",
      ] },
      { type: "p", text: "These numbers do not say most companies fail. They say that winning the award rarely builds the market on its own. A selection opens a door. It is not a contract, and it is not a customer." },
      { type: "h2", text: "The gap is commercial, not technical" },
      { type: "p", text: "The teams that stall at this point usually have strong technology. What they lack is positioning for a buyer outside the funding program, a presence that holds up when that buyer looks them up and a steady way to create demand." },
      { type: "p", text: "That is the work of Position, Build and Activate, in that order. Each prong answers a question the company can't skip: who buys this and why, will they believe us and will they act." },
      { type: "source", text: "Sources: GAO-26-108750, Small Business Research Programs: Better Data Could Improve Insight into Companies' Success (Sept 29, 2026), Table 1. A. Bresler and A. Bresler, SYM-AM-23-101, NPS Acquisition Research Symposium (Apr 30, 2023). National Academies, Review of the SBIR and STTR Programs at the Department of Defense (2026), Ch. 8. Figures are the publishers' findings, not Trident's." },
    ],
  },
  {
    slug: "exact-status-language",
    title: "Say exactly what you won",
    summary: "Precise credential language builds trust with commercial buyers. Loose language costs it. A short guide to stating awards and selections accurately.",
    published: "2026-11-25",
    readingMinutes: 3,
    body: [
      { type: "p", text: "A credential is only useful if a buyer can check it. The fastest way to lose a sophisticated buyer is to overstate one." },
      { type: "h2", text: "Name the selection, the program and the date" },
      { type: "ul", items: [
        "Say \"Selected as Awardable on the [marketplace name], [month year]\". Don't say \"won a contract on [marketplace]\". Awardable status is a door, not a contract.",
        "Say \"SBIR Phase II awardee, [agency], [year]\". Don't say \"endorsed by [agency]\" or \"backed by the government\".",
        "Say \"works with companies across federal innovation programs\". Don't say \"official partner of [program]\".",
      ] },
      { type: "h2", text: "Keep the source on file" },
      { type: "p", text: "Every credential you publish should have a public source and a date on file. If someone asks, you can show it in seconds. If you can't find the source, don't publish the claim." },
      { type: "h2", text: "No seals or marks without permission" },
      { type: "p", text: "Agency and program seals, logos and marks signal endorsement. Don't use them in your materials without written permission from the owning agency." },
      { type: "p", text: "Validated means a competitive selection: an award, or an assessment as awardable. It is not a product certification and not an endorsement. Use it only beside a named, dated credential." },
    ],
  },
];

export const faqs = [
  { q: "Is the Commercial Readiness Index a certification?", a: "No. It is Trident's own preliminary assessment methodology. It is not a government certification, an endorsement or a validated industry benchmark." },
  { q: "Are you affiliated with any government program or marketplace?", a: "No. Trident is an independent company. It is not affiliated with, endorsed by or acting on behalf of any government agency or program." },
  { q: "What should I not include in an application?", a: "Do not submit classified information, controlled unclassified information (CUI), export-controlled technical data, confidential third-party information or anything else Trident is not authorized to process." },
  { q: "Are retainers unlimited?", a: "No. Every plan has defined monthly allowances, revision limits and exclusions. Work beyond an allowance is quoted and approved before production begins." },
];
