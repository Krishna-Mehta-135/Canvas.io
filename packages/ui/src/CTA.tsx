import {ArrowRight, Sparkles} from "lucide-react";

export default function CTA() {
    return (
        <section id="pricing" className="scroll-mt-20 py-16 lg:py-20 bg-linear-to-br from-blue-600 via-cyan-500 to-blue-600 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
                    </pattern>
                    <rect width="100" height="100" fill="url(#grid)" />
                </svg>
            </div>

            <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-10 text-center relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-8 border border-white/30">
                    <Sparkles className="w-4 h-4 text-white" />
                    <span className="text-sm font-medium text-white">Free forever for unlimited users</span>
                </div>

                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-7 leading-tight">
                    Start sketching today
                </h2>

                <p className="text-xl text-blue-100 mb-12 leading-relaxed">
                    Join thousands of teams using Sketchboard to bring their ideas to life. No credit card required.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center sm:items-stretch">
                    <a
                        href="/signup"
                        className="group w-full sm:w-auto px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold text-lg hover:bg-gray-50 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                    >
                        Launch Canvas
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </a>
                </div>

                <p className="mt-8 text-blue-100 text-sm">Open source and privacy-focused. Your data stays yours.</p>
            </div>
        </section>
    );
}
