/**
 * Trident Commercial Readiness Index — framework v1 (seed).
 *
 * This is Trident's own preliminary methodology. It is NOT a government
 * certification, an industry benchmark or a validated predictive model.
 * Weights and criteria are versioned in the database; change them by
 * publishing a new framework version, never by editing a live one.
 *
 * Every option carries a score 0-100, or `null` for "Not sure", which is
 * recorded as missing information and excluded from the score rather than
 * treated as poor performance.
 *
 * Keep this file free of path aliases: scripts/seed.ts imports it directly.
 */

export interface FrameworkOption {
  value: string;
  label: string;
  score: number | null;
}

export interface FrameworkCriterion {
  key: string;
  category: string;
  prompt: string;
  help?: string;
  weight: number;
  options: FrameworkOption[];
  improvement: string;
  services: string[];
}

export interface FrameworkCategory {
  key: string;
  name: string;
  weight: number; // fraction of 1
  description: string;
}

export const FRAMEWORK_KEY = "commercial_readiness";
export const FRAMEWORK_VERSION = 1;

export const methodologyNote =
  "The Trident Commercial Readiness Index is Trident's own preliminary assessment methodology. It is not a government certification, an endorsement or a validated industry benchmark. Self-assessment results reflect the answers provided and have not been reviewed by a Trident strategist unless marked as reviewed.";

export const frameworkCategories: FrameworkCategory[] = [
  { key: "market_positioning", name: "Market positioning", weight: 0.2, description: "Whether a commercial buyer can tell who you serve, what you solve and why you are different." },
  { key: "brand_identity", name: "Brand identity", weight: 0.15, description: "Whether your identity is consistent, professional and usable by your team." },
  { key: "digital_presence", name: "Digital presence", weight: 0.2, description: "Whether buyers who look for you find a credible, current presence." },
  { key: "sales_enablement", name: "Sales enablement", weight: 0.15, description: "Whether you have the materials to move a conversation forward." },
  { key: "marketing_demand", name: "Marketing and demand generation", weight: 0.2, description: "Whether you create consistent attention with the right buyers." },
  { key: "commercial_infrastructure", name: "Commercial infrastructure", weight: 0.1, description: "Whether the basic systems to capture and follow up on demand exist." },
];

const notSure: FrameworkOption = { value: "not_sure", label: "Not sure", score: null };

export const frameworkCriteria: FrameworkCriterion[] = [
  // Market positioning (20%)
  {
    key: "target_buyer_defined",
    category: "market_positioning",
    prompt: "How clearly have you defined your commercial buyer beyond the program that funded you?",
    weight: 1.2,
    options: [
      { value: "none", label: "We sell mainly to the program that funded us", score: 0 },
      { value: "broad", label: "We have a broad idea (for example, 'industry')", score: 35 },
      { value: "segments", label: "We have named segments and buyer roles", score: 70 },
      { value: "validated", label: "Named segments, roles and buyer conversations to back them", score: 100 },
      notSure,
    ],
    improvement: "Map commercial buyers and markets beyond the funding program, with named roles and the problem each one pays to solve.",
    services: ["position-sprint"],
  },
  {
    key: "positioning_statement",
    category: "market_positioning",
    prompt: "Do you have a written positioning statement your whole team uses?",
    weight: 1,
    options: [
      { value: "no", label: "No", score: 0 },
      { value: "informal", label: "Informally, it varies by person", score: 30 },
      { value: "written", label: "Written, but not used consistently", score: 65 },
      { value: "used", label: "Written and used everywhere", score: 100 },
      notSure,
    ],
    improvement: "Write one positioning statement and value proposition, then use it on every surface.",
    services: ["position-sprint"],
  },
  {
    key: "differentiation",
    category: "market_positioning",
    prompt: "Can you name your top alternatives and explain in one sentence why a buyer should choose you?",
    weight: 1,
    options: [
      { value: "no", label: "Not yet", score: 0 },
      { value: "technical", label: "Only in technical terms", score: 40 },
      { value: "commercial", label: "Yes, in terms a commercial buyer understands", score: 100 },
      notSure,
    ],
    improvement: "Review the competitive landscape and express differentiation in commercial, not only technical, terms.",
    services: ["position-sprint", "commercial-readiness-audit"],
  },
  // Brand identity (15%)
  {
    key: "visual_identity",
    category: "brand_identity",
    prompt: "Which best describes your logo and visual identity?",
    weight: 1,
    options: [
      { value: "none", label: "No logo, or a placeholder", score: 0 },
      { value: "basic", label: "A logo, but no defined colors or type", score: 35 },
      { value: "system", label: "Logo, colors and type defined", score: 75 },
      { value: "guidelines", label: "A full system with written guidelines", score: 100 },
      notSure,
    ],
    improvement: "Establish a complete identity: vector logo files, palette, type and usage rules.",
    services: ["logo-visual-identity", "complete-brand-identity", "brand-guidelines"],
  },
  {
    key: "brand_consistency",
    category: "brand_identity",
    prompt: "How consistent are your website, decks and documents with each other?",
    weight: 1,
    options: [
      { value: "inconsistent", label: "They look like different companies", score: 10 },
      { value: "partial", label: "Mostly consistent", score: 55 },
      { value: "consistent", label: "Consistent, built from shared templates", score: 100 },
      notSure,
    ],
    improvement: "Build shared templates for slides, documents and social so every asset starts on brand.",
    services: ["complete-brand-identity", "build-kit"],
  },
  // Digital presence (20%)
  {
    key: "website_state",
    category: "digital_presence",
    prompt: "How would a commercial buyer experience your website today?",
    weight: 1.3,
    options: [
      { value: "none", label: "We don't have one", score: 0 },
      { value: "outdated", label: "Outdated or written for reviewers, not buyers", score: 25 },
      { value: "adequate", label: "Current, but not built to generate inquiries", score: 60 },
      { value: "effective", label: "Current, clear and generating qualified inquiries", score: 100 },
      notSure,
    ],
    improvement: "Rebuild the website around the commercial buyer, with a clear next step on every page.",
    services: ["startup-website", "corporate-website", "landing-page"],
  },
  {
    key: "linkedin_presence",
    category: "digital_presence",
    prompt: "What is the state of your company LinkedIn page?",
    weight: 1,
    options: [
      { value: "none", label: "No page", score: 0 },
      { value: "dormant", label: "A page, rarely updated", score: 25 },
      { value: "occasional", label: "Posts a few times a month", score: 60 },
      { value: "active", label: "Branded and active every week", score: 100 },
      notSure,
    ],
    improvement: "Brand the LinkedIn page and set a steady cadence of 2 to 3 posts a week.",
    services: ["social-media-template-system", "90-day-activate-program"],
  },
  {
    key: "credentials_presented",
    category: "digital_presence",
    prompt: "Are your awards and selections presented accurately and with dates where buyers can see them?",
    help: "For example: 'Selected as Awardable on [marketplace], [month year]' rather than 'won a contract'.",
    weight: 0.8,
    options: [
      { value: "no", label: "Not presented", score: 0 },
      { value: "loosely", label: "Mentioned, but not precisely", score: 40 },
      { value: "precisely", label: "Exact, dated and sourced", score: 100 },
      { value: "none_held", label: "We don't hold any yet", score: null },
      notSure,
    ],
    improvement: "Present each credential in exact, dated status language with its source on file.",
    services: ["capability-statement", "startup-website"],
  },
  // Sales enablement (15%)
  {
    key: "core_materials",
    category: "sales_enablement",
    prompt: "Which sales materials do you have that you are proud to send?",
    weight: 1.2,
    options: [
      { value: "none", label: "None", score: 0 },
      { value: "one", label: "One (for example, a deck)", score: 35 },
      { value: "several", label: "Deck, one-pager and capability statement", score: 80 },
      { value: "full", label: "A full set, kept current with templates", score: 100 },
      notSure,
    ],
    improvement: "Produce the core set: capability statement, product one-pager and a pitch deck with a blank master.",
    services: ["capability-statement", "product-one-pager", "investor-pitch-deck"],
  },
  {
    key: "pitch_clarity",
    category: "sales_enablement",
    prompt: "Can a non-technical buyer understand your pitch in under two minutes?",
    weight: 1,
    options: [
      { value: "no", label: "No, it needs the technical team", score: 10 },
      { value: "sometimes", label: "Depends who is presenting", score: 50 },
      { value: "yes", label: "Yes, consistently", score: 100 },
      notSure,
    ],
    improvement: "Write a pitch narrative that leads with the buyer's problem, then the technology.",
    services: ["position-sprint", "marketplace-pitch-development"],
  },
  // Marketing and demand generation (20%)
  {
    key: "marketing_cadence",
    category: "marketing_demand",
    prompt: "How often does your company publish or send marketing content?",
    weight: 1.2,
    options: [
      { value: "never", label: "Rarely or never", score: 0 },
      { value: "ad_hoc", label: "Around announcements only", score: 30 },
      { value: "monthly", label: "A few times a month", score: 65 },
      { value: "planned", label: "Weekly, from a content calendar", score: 100 },
      notSure,
    ],
    improvement: "Plan a 90-day content calendar built on point-of-view and method posts.",
    services: ["90-day-activate-program"],
  },
  {
    key: "thought_leadership",
    category: "marketing_demand",
    prompt: "Do your founders or executives publish their own point of view?",
    weight: 0.8,
    options: [
      { value: "no", label: "No", score: 0 },
      { value: "occasionally", label: "Occasionally", score: 50 },
      { value: "regularly", label: "Regularly", score: 100 },
      notSure,
    ],
    improvement: "Give one or two executives a regular, ghost-written point-of-view cadence.",
    services: ["90-day-activate-program"],
  },
  {
    key: "measurement",
    category: "marketing_demand",
    prompt: "Do you measure marketing results against targets?",
    weight: 0.8,
    options: [
      { value: "no", label: "No", score: 0 },
      { value: "some", label: "We look at some numbers", score: 45 },
      { value: "monthly", label: "Monthly, against agreed targets", score: 100 },
      notSure,
    ],
    improvement: "Agree targets (followers, engagement, inbound conversations) and review them monthly.",
    services: ["90-day-activate-program"],
  },
  // Commercial infrastructure (10%)
  {
    key: "crm",
    category: "commercial_infrastructure",
    prompt: "How do you track prospects and follow-ups?",
    weight: 1,
    options: [
      { value: "none", label: "We don't, or in someone's inbox", score: 0 },
      { value: "spreadsheet", label: "A spreadsheet", score: 45 },
      { value: "crm", label: "A CRM used by the team", score: 100 },
      notSure,
    ],
    improvement: "Adopt a simple CRM so every inquiry has an owner and a next step.",
    services: ["commercial-readiness-audit"],
  },
  {
    key: "inquiry_capture",
    category: "commercial_infrastructure",
    prompt: "What happens when a buyer wants to contact you from your website?",
    weight: 1,
    options: [
      { value: "nothing", label: "There is no clear way", score: 0 },
      { value: "email", label: "A generic email address", score: 40 },
      { value: "form", label: "A form that routes to an owner", score: 100 },
      notSure,
    ],
    improvement: "Add a clear contact path that routes each inquiry to an owner within one business day.",
    services: ["landing-page", "startup-website"],
  },
  {
    key: "marketing_capacity",
    category: "commercial_infrastructure",
    prompt: "Who owns marketing in your company today?",
    weight: 0.8,
    options: [
      { value: "nobody", label: "Nobody specifically", score: 0 },
      { value: "founder", label: "A founder, alongside everything else", score: 35 },
      { value: "part_time", label: "A part-time person or contractor", score: 65 },
      { value: "dedicated", label: "A dedicated person or team", score: 100 },
      notSure,
    ],
    improvement: "Assign clear marketing ownership, internally or with a fractional partner.",
    services: ["90-day-activate-program"],
  },
];
