import type { Metadata } from "next";
import { homeHtml } from "@/components/home/home-html";
import { HomeExtras } from "@/components/home/extras";
import { AiShowcase } from "@/components/home/ai-showcase";
import { SiteMotion } from "@/components/home/site-motion";
import { HeroAI } from "@/components/home/hero-ai";
import { GrowthEngine } from "@/components/home/growth-engine";
import "@/components/home/home.css";
import "@/components/home/hero.css";

// The public homepage at os.scalency.us. "Get started" goes to /signup, "Log in" to /login.
export const metadata: Metadata = {
  title: { absolute: "Scalency · The AI growth system: lead generation and lead conversion" },
  description: "Scalency brings you the leads, answers every enquiry with AI in under 60 seconds, books them into your calendar and follows up until they turn up. Ads, AI front desk, CRM and calendar in one place.",
};

// The page is the approved design, split so the new pieces slot in: the AI hero replaces the old
// hero, "two engines" follows the industry strip, the AI front desk sections go in after the core
// features, and the product map, lead flow and agencies sections just before the FAQ.
const sections: number[] = [];
for (let i = homeHtml.indexOf("<section"); i >= 0; i = homeHtml.indexOf("<section", i + 1)) sections.push(i);
const HERO_AT = sections[0] ?? -1;
const STRIP_AT = sections[1] ?? -1;
const WHY_AT = sections[2] ?? -1;
const AI_AT = homeHtml.indexOf('<section id="ai"');
const FAQ_AT = homeHtml.indexOf('<section id="faq"');
const ok = HERO_AT > 0 && STRIP_AT > HERO_AT && WHY_AT > STRIP_AT && AI_AT > WHY_AT && FAQ_AT > AI_AT;
const wrap = (html: string) => '<div class="site">' + html + "</div>";
const head = ok ? homeHtml.slice(0, HERO_AT) + "</div>" : homeHtml;
const strip = ok ? wrap(homeHtml.slice(STRIP_AT, WHY_AT)) : "";
const top = ok ? wrap(homeHtml.slice(WHY_AT, AI_AT)) : "";
const middle = ok ? wrap(homeHtml.slice(AI_AT, FAQ_AT)) : "";
const bottom = ok ? '<div class="site">' + homeHtml.slice(FAQ_AT) : "";

export default function Home() {
  return (
    <>
      <SiteMotion />
      <div dangerouslySetInnerHTML={{ __html: head }} />
      {ok && <HeroAI />}
      {strip && <div dangerouslySetInnerHTML={{ __html: strip }} />}
      {ok && <GrowthEngine />}
      {top && <div dangerouslySetInnerHTML={{ __html: top }} />}
      {ok && <AiShowcase />}
      {middle && <div dangerouslySetInnerHTML={{ __html: middle }} />}
      <HomeExtras />
      {bottom && <div dangerouslySetInnerHTML={{ __html: bottom }} />}
    </>
  );
}
