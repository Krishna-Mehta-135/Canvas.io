import {Pencil, Users, Zap, Lock, Download, Palette} from "lucide-react";

const features = [
    {
        icon: Pencil,
        title: "Hand-drawn feel",
        description: "Create diagrams that look like they were sketched by hand, giving your work a personal touch.",
        color: "bg-blue-50 text-blue-600",
    },
    {
        icon: Users,
        title: "Real-time collaboration",
        description: "Work together with your team in real-time. See changes as they happen.",
        color: "bg-green-50 text-green-600",
    },
    {
        icon: Lock,
        title: "End-to-end encrypted",
        description: "Your data is encrypted and secure. Privacy-first design ensures your work stays private.",
        color: "bg-amber-50 text-amber-600",
    },
    {
        icon: Zap,
        title: "Lightning fast",
        description: "No lag, no delays. Draw and sketch with the speed of thought.",
        color: "bg-cyan-50 text-cyan-600",
    },
    {
        icon: Download,
        title: "Export anywhere",
        description: "Export to PNG, SVG, or clipboard. Share your work however you need.",
        color: "bg-rose-50 text-rose-600",
    },
    {
        icon: Palette,
        title: "Infinite canvas",
        description: "Never run out of space. Pan and zoom to create as much as you need.",
        color: "bg-emerald-50 text-emerald-600",
    },
];

export default function Features() {
    return (
        <section id="features" className="scroll-mt-24 py-24 lg:py-28 bg-white">
            <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
                <div className="text-center mb-16">
                    <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5">Everything you need to sketch</h2>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Powerful features wrapped in a simple, intuitive interface.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                    {features.map((feature) => (
                        <div
                            key={feature.title}
                            className="group flex flex-col p-7 sm:p-8 rounded-2xl border-2 border-gray-200 hover:border-gray-900 transition-all hover:shadow-lg bg-white"
                        >
                            <div className={`inline-flex p-2.5 rounded-xl ${feature.color} mb-4 self-start`}>
                                <feature.icon className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                            <p className="text-gray-600 leading-relaxed text-sm">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
