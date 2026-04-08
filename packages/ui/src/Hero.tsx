import {ArrowRight, Pencil, Play, Sparkles} from "lucide-react";

export default function Hero() {
    return (
        <section className="relative overflow-hidden bg-linear-to-b from-amber-50 via-white to-white">
            <div className="absolute -top-20 -left-12 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl" />
            <div className="absolute top-16 right-0 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl" />

            <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 pt-20 pb-12 sm:pt-24 sm:pb-16 lg:pt-26 lg:pb-18">
                <div className="grid lg:grid-cols-2 gap-14 lg:gap-16 items-center">
                    <div className="text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-full mb-8 border-2 border-amber-900/10">
                            <Sparkles className="w-4 h-4 text-amber-700" />
                            <span className="text-sm font-medium text-amber-900">Built for fast collaborative whiteboarding</span>
                        </div>

                        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-8 leading-tight">
                            Visual thinking
                            <span className="block text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-cyan-500">
                                without friction
                            </span>
                        </h1>

                        <p className="text-xl text-gray-600 max-w-xl mx-auto lg:mx-0 mb-12 leading-relaxed">
                            Brainstorm, map systems, and present ideas on an infinite board with a hand-drawn feel and live multiplayer editing.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center lg:items-start justify-center lg:justify-start">
                            <a
                                href="/signup"
                                className="group px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                            >
                                Start drawing free
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </a>
                            <a
                                href="#showcase"
                                className="px-8 py-4 bg-white text-gray-700 rounded-lg font-semibold text-lg hover:bg-gray-50 transition-all border-2 border-gray-200 flex items-center justify-center gap-2"
                            >
                                <Play className="w-5 h-5" />
                                View examples
                            </a>
                        </div>

                        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-gray-600 justify-center lg:justify-start">
                            <div className="inline-flex items-center gap-2">
                                <Pencil className="w-4 h-4 text-blue-600" />
                                Unlimited boards
                            </div>
                            <div className="inline-flex items-center gap-2">
                                <Pencil className="w-4 h-4 text-blue-600" />
                                End-to-end encrypted
                            </div>
                            <div className="inline-flex items-center gap-2">
                                <Pencil className="w-4 h-4 text-blue-600" />
                                Real-time multiplayer
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 bg-linear-to-r from-blue-300/20 to-cyan-300/30 blur-2xl rounded-3xl" />
                        <div className="relative rounded-3xl border-4 border-gray-900 shadow-2xl overflow-hidden bg-white p-8 sm:p-9">
                            <div className="mb-7 flex items-center justify-between">
                                <p className="font-semibold text-gray-800">Product Launch Plan</p>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">3 people editing</span>
                            </div>
                            <div className="grid grid-cols-3 gap-7">
                                <SketchBox color="bg-blue-100" />
                                <SketchBox color="bg-green-100" />
                                <SketchBox color="bg-amber-100" />
                            </div>
                            <div className="mt-7 rounded-xl border-2 border-gray-200 p-4">
                                <p className="text-sm text-gray-600">"Whiteboard flow is smooth and way more readable than static docs."</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function SketchBox({color}: {color: string}) {
    return (
        <div className={`${color} rounded-lg border-2 border-gray-900 aspect-square relative overflow-hidden`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                <path
                    d="M20,50 Q30,30 50,40 T80,50"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    className="text-gray-900"
                />
                <circle cx="50" cy="50" r="15" fill="currentColor" className="text-gray-900" opacity="0.2" />
            </svg>
        </div>
    );
}
