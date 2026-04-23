import { Navbar } from './components/landing/Navbar';
import { HeroSection } from './components/landing/HeroSection';
import { InteractiveDemoSection } from './components/landing/InteractiveDemoSection';
import { FeaturesSection } from './components/landing/FeaturesSection';
import { ToolbarShowcase } from './components/landing/ToolbarShowcase';
import { AIHighlightSection } from './components/landing/AIHighlightSection';
import { HowItWorksSection } from './components/landing/HowItWorksSection';
import { FinalCTASection } from './components/landing/FinalCTASection';
import { Footer } from './components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white overflow-x-hidden transition-colors duration-300">
      <Navbar />
      <HeroSection />
      <InteractiveDemoSection />
      <FeaturesSection />
      <ToolbarShowcase />
      <AIHighlightSection />
      <HowItWorksSection />
      <FinalCTASection />
      <Footer />
    </div>
  );
}

