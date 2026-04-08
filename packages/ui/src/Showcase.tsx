export default function Showcase() {
    return (
        <section id="showcase" className="scroll-mt-20 py-16 lg:py-20 bg-linear-to-b from-white to-gray-50">
            <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
            <div className="text-center mb-10">
                    <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">From ideas to diagrams</h2>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Sketch flowcharts, wireframes, system designs, and more.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
                    <ShowcaseCard title="Flowcharts" color="from-blue-400 to-cyan-400">
                        <svg viewBox="0 0 200 200" className="w-full h-full">
                            <rect
                                x="70"
                                y="20"
                                width="60"
                                height="30"
                                rx="4"
                                fill="white"
                                stroke="currentColor"
                                strokeWidth="2"
                            />
                            <path d="M100,50 L100,80" stroke="currentColor" strokeWidth="2" fill="none" />
                            <polygon points="100,80 95,70 105,70" fill="currentColor" />
                            <path
                                d="M100,90 Q80,110 100,130 T100,150"
                                fill="white"
                                stroke="currentColor"
                                strokeWidth="2"
                            />
                            <rect
                                x="70"
                                y="160"
                                width="60"
                                height="30"
                                rx="4"
                                fill="white"
                                stroke="currentColor"
                                strokeWidth="2"
                            />
                        </svg>
                    </ShowcaseCard>

                    <ShowcaseCard title="Wireframes" color="from-green-400 to-emerald-400">
                        <svg viewBox="0 0 200 200" className="w-full h-full">
                            <rect
                                x="30"
                                y="30"
                                width="140"
                                height="140"
                                rx="8"
                                fill="white"
                                stroke="currentColor"
                                strokeWidth="2"
                            />
                            <rect x="40" y="40" width="120" height="20" rx="4" fill="currentColor" opacity="0.2" />
                            <rect x="40" y="70" width="50" height="50" rx="4" fill="currentColor" opacity="0.2" />
                            <rect x="100" y="70" width="60" height="15" rx="2" fill="currentColor" opacity="0.2" />
                            <rect x="100" y="95" width="60" height="15" rx="2" fill="currentColor" opacity="0.2" />
                            <rect x="40" y="130" width="120" height="30" rx="4" fill="currentColor" opacity="0.2" />
                        </svg>
                    </ShowcaseCard>

                    <ShowcaseCard title="Mind Maps" color="from-amber-400 to-orange-400">
                        <svg viewBox="0 0 200 200" className="w-full h-full">
                            <circle cx="100" cy="100" r="25" fill="white" stroke="currentColor" strokeWidth="2" />
                            <line x1="125" y1="100" x2="170" y2="70" stroke="currentColor" strokeWidth="2" />
                            <circle cx="170" cy="70" r="15" fill="white" stroke="currentColor" strokeWidth="2" />
                            <line x1="125" y1="100" x2="170" y2="130" stroke="currentColor" strokeWidth="2" />
                            <circle cx="170" cy="130" r="15" fill="white" stroke="currentColor" strokeWidth="2" />
                            <line x1="75" y1="100" x2="30" y2="70" stroke="currentColor" strokeWidth="2" />
                            <circle cx="30" cy="70" r="15" fill="white" stroke="currentColor" strokeWidth="2" />
                            <line x1="75" y1="100" x2="30" y2="130" stroke="currentColor" strokeWidth="2" />
                            <circle cx="30" cy="130" r="15" fill="white" stroke="currentColor" strokeWidth="2" />
                        </svg>
                    </ShowcaseCard>

                    <ShowcaseCard title="Architecture" color="from-rose-400 to-pink-400">
                        <svg viewBox="0 0 200 200" className="w-full h-full">
                            <rect
                                x="30"
                                y="40"
                                width="50"
                                height="40"
                                rx="4"
                                fill="white"
                                stroke="currentColor"
                                strokeWidth="2"
                            />
                            <rect
                                x="120"
                                y="40"
                                width="50"
                                height="40"
                                rx="4"
                                fill="white"
                                stroke="currentColor"
                                strokeWidth="2"
                            />
                            <rect
                                x="75"
                                y="120"
                                width="50"
                                height="40"
                                rx="4"
                                fill="white"
                                stroke="currentColor"
                                strokeWidth="2"
                            />
                            <path
                                d="M55,80 L55,100 L100,100 L100,120"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                            />
                            <path d="M145,80 L145,100 L100,100" stroke="currentColor" strokeWidth="2" fill="none" />
                        </svg>
                    </ShowcaseCard>
                </div>
            </div>
        </section>
    );
}

function ShowcaseCard({title, color, children}: {title: string; color: string; children: React.ReactNode}) {
    return (
        <div className="group relative">
            <div
                className={`absolute inset-0 bg-linear-to-br ${color} rounded-2xl opacity-50 group-hover:opacity-70 transition-opacity`}
            ></div>
            <div className="relative p-6 sm:p-8 rounded-2xl border-2 border-gray-900 bg-white overflow-hidden">
                <h3 className="text-xl font-bold text-gray-900 mb-5">{title}</h3>
                <div className="aspect-square bg-gray-50 rounded-xl border-2 border-gray-900 p-6 sm:p-8 text-gray-900">
                    {children}
                </div>
            </div>
        </div>
    );
}
