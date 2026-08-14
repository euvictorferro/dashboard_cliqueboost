import type { Metadata } from "next";
import { LanguageProvider } from "@/components/landing/LanguageProvider";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { PainPoints } from "@/components/landing/PainPoints";
import { PromiseSection } from "@/components/landing/Promise";
import { Services } from "@/components/landing/Services";
import { Process } from "@/components/landing/Process";
import { Testimonials } from "@/components/landing/Testimonials";
import { TechDifferentiator } from "@/components/landing/TechDifferentiator";
import { Faq } from "@/components/landing/Faq";
import { ApplicationForm } from "@/components/landing/ApplicationForm";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Clique Boost — Marketing 360 for Brokers",
  description:
    "Full-service marketing for U.S. real estate and insurance brokers: content, paid traffic, design, and strategy — so you can focus on selling.",
};

export default function LandingPage() {
  return (
    <LanguageProvider>
      <Header />
      <main>
        <Hero />
        <PainPoints />
        <PromiseSection />
        <Services />
        <Process />
        <Testimonials />
        <TechDifferentiator />
        <Faq />
        <ApplicationForm />
      </main>
      <Footer />
    </LanguageProvider>
  );
}
