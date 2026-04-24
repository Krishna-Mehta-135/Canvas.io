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
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_18%_12%,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_82%_10%,rgba(16,185,129,0.10),transparent_24%),linear-gradient(180deg,#f3f8ff_0%,#ffffff_48%,#f8fbff_100%)] text-gray-900 transition-colors duration-300 dark:bg-[radial-gradient(circle_at_18%_12%,rgba(59,130,246,0.20),transparent_30%),radial-gradient(circle_at_82%_10%,rgba(139,92,246,0.16),transparent_24%),linear-gradient(180deg,#0f172a_0%,#020617_70%,#020617_100%)] dark:text-white">
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

