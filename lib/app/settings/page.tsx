"use client";

import { motion } from "framer-motion";
import { Settings, ArrowLeft, User, Info } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
    return (
        <main className="min-h-screen bg-[#F0F7FF] text-slate-800 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <header className="mb-8 flex items-center justify-between">
                    <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors">
                        <ArrowLeft className="w-5 h-5 mr-1" />
                        <span className="font-medium">ホーム</span>
                    </Link>
                    <h1 className="text-2xl font-bold text-blue-900">設定</h1>
                </header>

                <div className="space-y-6">
                    <div className="bg-white rounded-3xl shadow-xl shadow-blue-100/50 p-6 border border-white">
                        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                            <Info className="w-5 h-5 mr-2 text-blue-500" />
                            このアプリについて
                        </h2>
                        <div className="space-y-4 text-slate-600 leading-relaxed">
                            <p>
                                <strong>Swim Note</strong> は、AIの力を活用して水泳の練習記録を解析・管理するアプリです。
                            </p>
                            <p>
                                バージョン: 1.0.0
                            </p>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-xl shadow-blue-100/50 p-6 border border-white">
                        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                            <User className="w-5 h-5 mr-2 text-blue-500" />
                            アカウント設定
                        </h2>
                        <p className="text-slate-400 italic">近日公開予定...</p>
                    </div>
                </div>
            </div>
        </main>
    );
}
