"use client";

import Header from '@repo/ui/Header';
import Hero from '@repo/ui/Hero';
import Features from '@repo/ui/Features';
import Showcase from '@repo/ui/Showcase';
import CTA from '@repo/ui/CTA';
import Footer from '@repo/ui/Footer';

function App() {
  return (
    <div className="home-surface">
      <Header />
      <main className="landing-main relative pt-0">
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
