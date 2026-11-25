import type { Metadata } from "next";
import { homeHtml } from "@/components/home/home-html";
import { HomeExtras } from "@/components/home/extras";
import { AiShowcase } from "@/components/home/ai-showcase";
import { SiteMotion } from "@/components/home/site-motion";
import { FlowEngine } from "@/components/home/flow-engine";
import { ProductTour } from "@/components/home/product-tour";
import { AskLauncher } from "@/components/home/ask-launcher";
import { HomeMotion } from "@/components/home/home-motion";
import { GrowthEngine } from "@/components/home/growth-engine";
import "@/components/home/home.css";
import "@/components/home/hero.css";

// The public homepage at os.scalency.us. "Get started" goes to /signup, "Log in" to /login.
export const metadata: Metadata = {
  title: { absolute: "Scalency · The AI growth system: lead generation and lead conversion" },
  description: "Scalency brings you the leads, answers every enquiry with AI in under 60 seconds, books them into your calendar and follows up until they turn up. Ads, AI front desk, CRM and calendar in one place.",
};

// The page is the approved design, kept as it is, with motion sections slotted in: "every channel
// in" after the industry strip, "two engines" after the problem section, the product tour after the
// core features, the AI front desk sections next, and the product map, lead flow and agencies just
// before the FAQ. The hero's dashboard, the orbit and the buttons are animated in place.
const sections: number[] = [];
for (let i = homeHtml.indexOf("<section"); i >= 0; i = homeHtml.indexOf("<section", i + 1)) sections.push(i);
const STRIP_AT = sections[1] ?? -1;
const WHY_AT = sections[2] ?? -1;
const FEATURES_AT = homeHtml.indexOf('<section id="features"');
const AI_AT = homeHtml.indexOf('<section id="ai"');
const FAQ_AT = homeHtml.indexOf('<section id="faq"');
const ok = STRIP_AT > 0 && WHY_AT > STRIP_AT && FEATURES_AT > WHY_AT && AI_AT > FEATURES_AT && FAQ_AT > AI_AT;
const wrap = (html: string) => '<div class="site">' + html + "</div>";
const head = ok ? homeHtml.slice(0, WHY_AT) + "</div>" : homeHtml;
const why = ok ? wrap(homeHtml.slice(WHY_AT, FEATURES_AT)) : "";
const features = ok ? wrap(homeHtml.slice(FEATURES_AT, AI_AT)) : "";
const middle = ok ? wrap(homeHtml.slice(AI_AT, FAQ_AT)) : "";
const bottom = ok ? '<div class="site">' + homeHtml.slice(FAQ_AT) : "";

export default function Home() {
  return (
    <>
      <SiteMotion />
      <HomeMotion />
      <div dangerouslySetInnerHTML={{ __html: head }} />
      {ok && <FlowEngine />}
      {why && <div dangerouslySetInnerHTML={{ __html: why }} />}
      {ok && <GrowthEngine />}
      {features && <div dangerouslySetInnerHTML={{ __html: features }} />}
      {ok && <ProductTour />}
      {ok && <AiShowcase />}
      {middle && <div dangerouslySetInnerHTML={{ __html: middle }} />}
      <HomeExtras />
      {bottom && <div dangerouslySetInnerHTML={{ __html: bottom }} />}
      <AskLauncher />
    </>
  );
}
