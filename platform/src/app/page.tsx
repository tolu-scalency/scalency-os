import type { Metadata } from "next";
import { homeHtml } from "@/components/home/home-html";
import { HomeExtras } from "@/components/home/extras";
import { AiShowcase } from "@/components/home/ai-showcase";
import { SiteMotion } from "@/components/home/site-motion";
import "@/components/home/home.css";

// The public homepage at os.scalency.us. "Get started" goes to /signup, "Log in" to /login.
export const metadata: Metadata = {
  title: { absolute: "Scalency OS · The AI front desk that answers, books and fills your diary" },
  description: "An AI front desk that replies in seconds, books into your calendar, reminds until people show up and proves revenue by channel. With CRM, pipeline, workflows and inbox built in.",
};

// The approved design is split twice: the AI front desk sections go in after the core features,
// and the product map, lead flow and agencies sections just before the FAQ.
const AI_AT = homeHtml.indexOf('<section id="ai"');
const FAQ_AT = homeHtml.indexOf('<section id="faq"');
const ok = AI_AT > 0 && FAQ_AT > AI_AT;
const top = ok ? homeHtml.slice(0, AI_AT) + "</div>" : homeHtml;
const middle = ok ? '<div class="site">' + homeHtml.slice(AI_AT, FAQ_AT) + "</div>" : "";
const bottom = ok ? '<div class="site">' + homeHtml.slice(FAQ_AT) : "";

export default function Home() {
  return (
    <>
      <SiteMotion />
      <div dangerouslySetInnerHTML={{ __html: top }} />
      {ok && <AiShowcase />}
      {middle && <div dangerouslySetInnerHTML={{ __html: middle }} />}
      <HomeExtras />
      {bottom && <div dangerouslySetInnerHTML={{ __html: bottom }} />}
    </>
  );
}
