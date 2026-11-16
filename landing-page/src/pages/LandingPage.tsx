import React from 'react';
import { BuiltWithAndProblemBand } from '../components/landing/BuiltWithAndProblemBand';
import { FaqSection } from '../components/landing/FaqSection';
import { FeaturesBento } from '../components/landing/FeaturesBento';
import { FinalCtaSection } from '../components/landing/FinalCtaSection';
import { Footer } from '../components/landing/Footer';
import { Hero } from '../components/landing/Hero';
import { HowItWorks } from '../components/landing/HowItWorks';
import { Integrations } from '../components/landing/Integrations';
import { Navbar } from '../components/landing/Navbar';
import { ProductTour } from '../components/landing/ProductTour';
import { UseCases } from '../components/landing/UseCases';
import { WhyBlispSection } from '../components/landing/WhyBlispSection';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-dvh flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-[60] focus:px-4 focus:py-2.5 focus:rounded-full focus:bg-[#C64A1B] focus:text-white focus:font-semibold focus:text-[14px] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#F5F2EC]"
      >
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <Hero />
        <BuiltWithAndProblemBand />
        <FeaturesBento />
        <ProductTour />
        <HowItWorks />
        <Integrations />
        <UseCases />
        <WhyBlispSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
};
