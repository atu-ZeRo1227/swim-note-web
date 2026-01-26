"use client";

import { motion } from "framer-motion";
import { History, ArrowLeft, Clock, Calendar } from "lucide-react";
import Link from "next/link";

export default function HistoryPage() {
    return (
        <main className="min-h-screen bg-[#F0F7FF] text-slate-800 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <header className="mb-8 flex items-center justify-between">
                    <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors">
                        <ArrowLeft className="w-5 h-5 mr-1" />
                        <span className="font-medium">ホーム</span>
                    </Link>
                    <h1 className="text-2xl font-bold text-blue-900">練習履歴</h1>
                </header>

                <div className="bg-white rounded-3xl shadow-xl shadow-blue-100/50 p-12 text-center border border-white">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <History className="w-10 h-10 text-blue-200" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-400 mb-2">履歴はまだありません</h2>
                    <p className="text-slate-400">練習を記録して、AIコーチの解析を始めましょう！</p>
                    <Link href="/analyze" className="mt-8 inline-block px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all">
                        記録を開始する
                    </Link>
                </div>
            </div>
        </main>
    );
}
