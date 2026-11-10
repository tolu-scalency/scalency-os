import type { Metadata } from "next";
import { homeHtml } from "@/components/home/home-html";
import "@/components/home/home.css";

// The public homepage at os.scalency.us. "Get started" goes to /signup, "Log in" to /login.
export const metadata: Metadata = {
  title: { absolute: "Scalency OS · Every enquiry answered, followed up and booked" },
  description: "Leads, pipeline, texts, emails and team alerts in one place, with the follow-up run for you.",
};

export default function Home() {
  return <div dangerouslySetInnerHTML={{ __html: homeHtml }} />;
}
