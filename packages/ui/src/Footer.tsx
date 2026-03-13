import {Github, Twitter, Heart} from "lucide-react";

export default function Footer() {
    return (
        <footer className="bg-gray-900 text-white py-14">
            <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
                <div className="grid md:grid-cols-4 gap-10 mb-10">
                    <div className="md:col-span-2">
                        <h3 className="text-xl font-bold mb-3">Sketchboard</h3>
                        <p className="text-gray-400 leading-relaxed mb-5 text-sm">
                            A virtual whiteboard for sketching hand-drawn like diagrams. Open source, collaborative, and
                            encrypted.
                        </p>
                        <div className="flex items-center gap-3">
                            <a href="#" className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center">
                                <Github className="w-4 h-4" />
                            </a>
                            <a href="#" className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center">
                                <Twitter className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-gray-300">Product</h4>
                        <ul className="space-y-3 text-gray-400 text-sm">
                            <li>
                                <a href="#" className="hover:text-white transition-colors">
                                    Features
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-white transition-colors">
                                    Pricing
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-white transition-colors">
                                    Changelog
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-white transition-colors">
                                    Documentation
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-gray-300">Company</h4>
                        <ul className="space-y-3 text-gray-400 text-sm">
                            <li>
                                <a href="#" className="hover:text-white transition-colors">
                                    About
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-white transition-colors">
                                    Blog
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-white transition-colors">
                                    Privacy
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-white transition-colors">
                                    Terms
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <p className="text-gray-500 text-sm">© 2024 Sketchboard. All rights reserved.</p>
                    <p className="text-gray-500 text-sm flex items-center gap-1.5">
                        Made with <Heart className="w-3.5 h-3.5 text-red-500 fill-current" /> for creators
                    </p>
                </div>
            </div>
        </footer>
    );
}
