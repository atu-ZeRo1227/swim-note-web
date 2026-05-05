"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, BookOpen, Lightbulb, Send, CheckCircle2, Quote, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

interface AnalysisResult {
    menu_fixed: string;
    note_points: string[];
    coach_comment: string;
}

export default function AnalyzePage() {
    const [duration, setDuration] = useState("");
    const [menu, setMenu] = useState("");
    const [insight, setInsight] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState("");

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setResult(null);

        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ duration, menu, insight }),
            });

            if (!response.ok) {
                throw new Error("解析に失敗しました。しばらく時間をおいてから再度お試しください。");
            }

            const data = await response.json();
            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#F0F7FF] text-slate-800 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <header className="mb-8 flex items-center justify-between">
                    <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors">
                        <ArrowLeft className="w-5 h-5 mr-1" />
                        <span className="font-medium">ホームへ戻る</span>
                    </Link>
                    <h1 className="text-2xl font-bold text-blue-900">AIコーチ解析</h1>
                </header>

                <AnimatePresence mode="wait">
                    {!result ? (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-white rounded-3xl shadow-xl shadow-blue-100/50 p-6 md:p-8 border border-white"
                        >
                            <form onSubmit={handleAnalyze} className="space-y-6">
                                <div>
                                    <label className="flex items-center text-sm font-semibold text-blue-900 mb-2">
                                        <Timer className="w-4 h-4 mr-2" />
                                        練習時間
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="例: 1時間, 45分"
                                        className="w-full px-4 py-3 bg-blue-50/50 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-blue-300"
                                        value={duration}
                                        onChange={(e) => setDuration(e.target.value)}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center text-sm font-semibold text-blue-900 mb-2">
                                        <BookOpen className="w-4 h-4 mr-2" />
                                        メニュー
                                    </label>
                                    <textarea
                                        placeholder="例: 50m x 10, KRL, 200m Fr"
                                        className="w-full px-4 py-3 bg-blue-50/50 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all h-32 resize-none placeholder:text-blue-300"
                                        value={menu}
                                        onChange={(e) => setMenu(e.target.value)}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center text-sm font-semibold text-blue-900 mb-2">
                                        <Lightbulb className="w-4 h-4 mr-2" />
                                        今日の気づき
                                    </label>
                                    <textarea
                                        placeholder="例: ターンでしっかり壁を蹴れた, 肘が高く保てた"
                                        className="w-full px-4 py-3 bg-blue-50/50 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all h-24 resize-none placeholder:text-blue-300"
                                        value={insight}
                                        onChange={(e) => setInsight(e.target.value)}
                                        required
                                    />
                                </div>

                                {error && (
                                    <p className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                                        {error}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-70 disabled:scale-100"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                            コーチが解析中...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5 mr-2" />
                                            AIコーチに送る
                                        </>
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-6"
                        >
                            {/* Analysis Card */}
                            <div className="bg-white rounded-3xl shadow-xl shadow-blue-100/50 overflow-hidden border border-white">
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center">
                                    <h2 className="text-xl font-bold">解析完了！</h2>
                                    <p className="text-blue-100 text-sm mt-1">AIコーチからのフィードバックです</p>
                                </div>

                                <div className="p-6 md:p-8 space-y-8">
                                    <section>
                                        <h3 className="flex items-center text-blue-900 font-bold mb-3">
                                            <CheckCircle2 className="w-5 h-5 mr-2 text-green-500" />
                                            メニュー整理
                                        </h3>
                                        <div className="bg-blue-50/50 rounded-2xl p-4 text-slate-700 leading-relaxed">
                                            {result.menu_fixed}
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="flex items-center text-blue-900 font-bold mb-3">
                                            <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
                                            ポイント
                                        </h3>
                                        <ul className="grid gap-3">
                                            {result.note_points.map((point, i) => (
                                                <li key={i} className="flex items-start bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold mr-3 flex-shrink-0 mt-0.5">
                                                        {i + 1}
                                                    </span>
                                                    <span className="text-slate-600">{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>

                                    <section className="relative">
                                        <Quote className="absolute -top-2 -left-2 w-10 h-10 text-blue-100 -z-0" />
                                        <div className="relative z-10 bg-indigo-50/80 rounded-2xl p-6 border border-indigo-100">
                                            <h3 className="text-indigo-900 font-bold mb-2">コーチのメッセージ</h3>
                                            <p className="text-indigo-700 leading-relaxed italic">
                                                「{result.coach_comment}」
                                            </p>
                                        </div>
                                    </section>
                                </div>
                            </div>

                            <button
                                onClick={() => setResult(null)}
                                className="w-full py-4 bg-white text-blue-600 font-bold rounded-2xl border-2 border-blue-100 hover:bg-blue-50 transition-all text-center"
                            >
                                新しい記録を入力する
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
