"use client"
import {Menu, X, Pencil} from "lucide-react";
import {useState} from "react";

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="fixed top-0 left-0 right-0 bg-white/85 backdrop-blur-lg border-b border-gray-200 z-50">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <a href="/" className="flex items-center gap-2" aria-label="Canvas home">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center border-2 border-gray-900">
                            <Pencil className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-gray-900">Canvas.io</span>
                    </a>

                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                            Features
                        </a>
                        <a href="#showcase" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                            Examples
                        </a>
                        <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                            Pricing
                        </a>
                        <a href="/signin" className="text-gray-700 hover:text-gray-900 font-medium transition-colors">
                            Sign in
                        </a>
                        <a
                            href="/signup"
                            className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                        >
                            Start free
                        </a>
                    </div>

                    <button className="md:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {isMenuOpen && (
                    <div className="md:hidden py-4 border-t border-gray-200">
                        <div className="flex flex-col gap-4">
                            <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium">
                                Features
                            </a>
                            <a href="#showcase" className="text-gray-600 hover:text-gray-900 font-medium">
                                Examples
                            </a>
                            <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium">
                                Pricing
                            </a>
                            <a
                                href="/signin"
                                className="px-6 py-2 border border-gray-300 text-gray-800 rounded-lg font-semibold text-center"
                            >
                                Sign in
                            </a>
                            <a
                                href="/signup"
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center"
                            >
                                Start free
                            </a>
                        </div>
                    </div>
                )}
            </nav>
        </header>
    );
}
