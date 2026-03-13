import Header from '@repo/ui/Header';
import Hero from '@repo/ui/Hero';
import Features from '@repo/ui/Features';
import Showcase from '@repo/ui/Showcase';
import CTA from '@repo/ui/CTA';
import Footer from '@repo/ui/Footer';

function App() {
  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-white text-slate-900">
      <Header />
      <main className="landing-main relative pt-20">
        <Hero />
        <Features />
        <Showcase />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

export default App;
