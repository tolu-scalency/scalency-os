import type { Metadata } from "next";
import { homeHtml } from "@/components/home/home-html";
import { HomeExtras } from "@/components/home/extras";
import "@/components/home/home.css";

// The public homepage at os.scalency.us. "Get started" goes to /signup, "Log in" to /login.
export const metadata: Metadata = {
  title: { absolute: "Scalency OS · Every enquiry answered, followed up and booked" },
  description: "Contacts, pipeline, workflows, inbox, team chat and AI in one place, with the follow-up run for you.",
};

// The approved design is split just before the FAQ so the extra sections can sit in the middle.
const SPLIT = '<section id="faq"';
const cut = homeHtml.indexOf(SPLIT);
const top = cut > 0 ? homeHtml.slice(0, cut) + "</div>" : homeHtml;
const bottom = cut > 0 ? '<div class="site">' + homeHtml.slice(cut) : "";

export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: top }} />
      <HomeExtras />
      {bottom && <div dangerouslySetInnerHTML={{ __html: bottom }} />}
    </>
  );
}
