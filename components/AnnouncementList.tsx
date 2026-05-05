"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";

interface Announcement {
    id: string;
    title: string;
    content: string;
    date: any; // timestamp or string
    type: string;
}

/**
 * Firestoreから「お知らせ」を取得し、カード形式で一覧表示するコンポーネント
 * 
 * データベース構造:
 * - コレクション: announce
 * - フィールド: title, content, date (timestamp or string), type
 */
const AnnouncementList = () => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. announceコレクションからデータを取得するクエリ
        const q = collection(db, "announce");

        // 2. リアルタイムリスナーを設定し全データを取得
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const news: Announcement[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            } as Announcement));

            // 3. dateフィールドを使用して新しい順（降順）に並べ替え
            const sorted = news.sort((a, b) => {
                const getTime = (val: any) => {
                    if (!val) return 0;
                    if (val.toDate) return val.toDate().getTime(); // Timestampの場合
                    return new Date(val).getTime(); // stringの場合
                };
                return getTime(b.date) - getTime(a.date);
            });

            setAnnouncements(sorted);
            setLoading(false);
        }, (error) => {
            console.error("Firestore error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 日付を「2026年1月26日」の形式に変換する関数
    const formatDate = (dateValue: any) => {
        if (!dateValue) return "";
        let d: Date;
        if (dateValue.toDate) {
            d = dateValue.toDate();
        } else {
            d = new Date(dateValue);
        }

        if (isNaN(d.getTime())) return String(dateValue); // パース失敗時はそのまま返す

        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 w-full max-w-md mx-auto p-4">
            {announcements.length > 0 ? (
                announcements.map((item) => (
                    <div
                        key={item.id}
                        className="bg-[#1a1a1a] p-6 rounded-2xl border border-gray-800 shadow-xl border-l-4 border-l-blue-500 flex flex-col transition-all hover:border-gray-700"
                    >
                        {/* 種類表示（type）と日付（date）のヘッダー */}
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-900/20 px-2 py-0.5 rounded leading-none">
                                {item.type}
                            </span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                {formatDate(item.date)}
                            </span>
                        </div>

                        {/* タイトル */}
                        <h3 className="text-lg font-extrabold text-white/95 mb-2 tracking-tight">
                            {item.title}
                        </h3>

                        {/* 本文内容 */}
                        <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
                            {item.content}
                        </p>
                    </div>
                ))
            ) : (
                /* データがない場合の表示 */
                <div className="text-center py-20 text-gray-500 bg-[#1a1a1a] rounded-2xl border border-gray-800 border-dashed">
                    <p className="text-xl mb-2">📢</p>
                    <p className="text-sm">新しいお知らせはありません</p>
                </div>
            )}
        </div>
    );
};

export default AnnouncementList;
