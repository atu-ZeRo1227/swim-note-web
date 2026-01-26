"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";

interface Profile {
    nickname: string;
    age: string;
    stroke: string;
    height: string;
    weight: string;
    gender: string;
}

interface DailyRecord {
    duration: string;
    menu: string;
    insight: string;
}

interface AIAnalysisResult {
    menu_fixed: string;
    note_points: string[];
    coach_comment: string;
}

interface SavedDailyRecord extends DailyRecord {
    date: string;
    rating: number;
    tags: string[];
    note_points?: string[];
    coach_comment?: string;
    menu_fixed?: string;
    original_menu?: string;
    original_insight?: string;
}

interface SwimmingTime {
    id?: string;
    stroke: string;
    distance: string;
    time: string;
    date?: string;
}

interface Announcement {
    id: string;
    type: string;
    title: string;
    content: string;
    date: string;
    timestamp: any;
}

export default function Home() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [needsSetup, setNeedsSetup] = useState(false);

    const [showSettings, setShowSettings] = useState(false);

    // Form states
    const [formData, setFormData] = useState<Profile>({
        nickname: "",
        age: "",
        stroke: "",
        height: "",
        weight: "",
        gender: "",
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showProfileDisplay, setShowProfileDisplay] = useState(false);
    const [showProfileEdit, setShowProfileEdit] = useState(false);
    const [showLoginDisplay, setShowLoginDisplay] = useState(false);
    const [showLoginEdit, setShowLoginEdit] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [showDailyInput, setShowDailyInput] = useState(false);
    const [showAIAnalysis, setShowAIAnalysis] = useState(false);
    const [showDailyHistory, setShowDailyHistory] = useState(false);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<SavedDailyRecord | null>(null);
    const [historyRecords, setHistoryRecords] = useState<SavedDailyRecord[]>([]);

    const [dailyForm, setDailyForm] = useState<DailyRecord>({
        duration: "",
        menu: "",
        insight: "",
    });
    const [rating, setRating] = useState(0);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    const [historySearch, setHistorySearch] = useState("");

    const [showTimeInput, setShowTimeInput] = useState(false);
    const [showTimeHistory, setShowTimeHistory] = useState(false);
    const [timeHistory, setTimeHistory] = useState<SwimmingTime[]>([]);
    const [editingTime, setEditingTime] = useState<SwimmingTime | null>(null);

    const [timeForm, setTimeForm] = useState<SwimmingTime>({
        stroke: "",
        distance: "",
        time: "",
    });

    const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);

    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [showNewsList, setShowNewsList] = useState(false);
    const [hasUnreadNews, setHasUnreadNews] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                if (isMounted) setUser(currentUser);

                // Initial profile fetch
                try {
                    const docRef = doc(db, "users", currentUser.uid);
                    const docSnap = await getDoc(docRef);

                    if (!isMounted) return;

                    if (docSnap.exists() && docSnap.data().nickname) {
                        const data = docSnap.data() as Profile;
                        setProfile(data);
                        setFormData(data); // Pre-fill form
                        setNeedsSetup(false);
                    } else {
                        setNeedsSetup(true);
                    }
                } catch (error) {
                    console.error("Firestore error:", error);
                    if (isMounted) setNeedsSetup(true);
                } finally {
                    if (isMounted) setLoading(false);
                }
            } else {
                router.push("/login");
                if (isMounted) setLoading(false);
            }
        });

        // Real-time Announcements Listener
        const q = collection(db, "announce");
        const unsubscribeNews = onSnapshot(q, (snapshot) => {
            const news: Announcement[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                news.push({
                    id: doc.id,
                    ...data
                } as Announcement);
            });

            // Sort by date (descending) or timestamp in JS to include docs without specific fields
            const sortedNews = news.sort((a, b) => {
                const getTime = (val: any) => {
                    if (!val) return 0;
                    if (val.toDate) return val.toDate().getTime(); // Firestore Timestamp
                    return new Date(val).getTime(); // date string
                };
                return getTime(b.date) - getTime(a.date);
            });

            if (isMounted) setAnnouncements(sortedNews);
        });

        return () => {
            isMounted = false;
            unsubscribe();
            unsubscribeNews();
        };
    }, [router]);

    useEffect(() => {
        if (announcements.length > 0) {
            const lastSeenId = localStorage.getItem("lastSeenNewsId");
            if (lastSeenId !== announcements[0].id) {
                setHasUnreadNews(true);
            }
        }
    }, [announcements]);

    const handleOpenNewsList = () => {
        setShowNewsList(true);
        if (announcements.length > 0) {
            localStorage.setItem("lastSeenNewsId", announcements[0].id);
            setHasUnreadNews(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push("/login");
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || isSubmitting) return;

        setIsSubmitting(true);

        try {
            const profileData = {
                ...formData,
                updatedAt: serverTimestamp(),
            };

            console.log("Saving profile for user:", user.uid, profileData);
            // Firestoreに「users」コレクションとしてプロファイル情報を保存します
            await setDoc(doc(db, "users", user.uid), profileData, { merge: true });
            console.log("Profile saved successfully to Firestore!");

            // 保存成功後に状態を更新
            setProfile({ ...formData });
            setNeedsSetup(false);
            setShowProfileEdit(false);
            setShowSettings(false);
        } catch (error: any) {
            console.error("Error saving profile to Firestore:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEmailUpdate = async (newEmail: string) => {
        if (!user || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const { updateEmail } = await import("firebase/auth");
            await updateEmail(user, newEmail);
            await setDoc(doc(db, "users", user.uid), { email: newEmail }, { merge: true });
            alert("メールアドレスを更新しました。");
            setShowLoginEdit(false);
        } catch (error: any) {
            console.error("Email update error:", error);
            if (error.code === "auth/requires-recent-login") {
                alert("セキュリティのため、再ログインしてから再度お試しください。");
            } else {
                alert(`更新に失敗しました: ${error.message}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePasswordUpdate = async (newPass: string) => {
        if (!user || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const { updatePassword } = await import("firebase/auth");
            await updatePassword(user, newPass);
            alert("パスワードを更新しました。");
            setShowLoginEdit(false);
        } catch (error: any) {
            console.error("Password update error:", error);
            if (error.code === "auth/requires-recent-login") {
                alert("セキュリティのため、再ログインしてから再度お試しください。");
            } else {
                alert(`更新に失敗しました: ${error.message}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDailySubmit = async (finalData: AIAnalysisResult) => {
        if (!user || isSubmitting) return;

        setIsSubmitting(true);

        try {
            const today = new Date().toISOString().split('T')[0];
            const timestamp = Date.now();
            const uniqueId = `${today}_${timestamp}`;

            // 既存の記録件数を確認
            const { collection, getDocs, query } = await import("firebase/firestore");
            const q = query(collection(db, "users", user.uid, "daily_records"));
            const snapshot = await getDocs(q);

            if (snapshot.size >= 5) {
                alert("記録は最大5件までです。");
                setIsSubmitting(false);
                return;
            }

            const finalTags = [...tags];
            if (tagInput.trim() && !finalTags.includes(tagInput.trim())) {
                finalTags.push(tagInput.trim());
            }

            const recordData = {
                duration: dailyForm.duration,
                menu: finalData.menu_fixed,
                note_points: finalData.note_points,
                coach_comment: finalData.coach_comment,
                original_menu: dailyForm.menu,
                original_insight: dailyForm.insight,
                rating: rating,
                tags: finalTags,
                date: today,
                timestamp: serverTimestamp(),
            };

            // ユニークなIDで保存して上書きを防止
            await setDoc(doc(db, "users", user.uid, "daily_records", uniqueId), recordData);
            console.log("Daily record saved!");
            setShowDailyInput(false);
            setShowAIAnalysis(false);
            setDailyForm({ duration: "", menu: "", insight: "" });
            setAnalysisResult(null);
            setRating(0);
            setTags([]);
            setTagInput("");
        } catch (error) {
            console.error("Error saving daily record:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSimpleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || isSubmitting) return;

        setIsSubmitting(true);

        try {
            const today = new Date().toISOString().split('T')[0];
            const timestamp = Date.now();
            const uniqueId = `${today}_${timestamp}`;

            // 既存の記録件数を確認
            const { collection, getDocs, query } = await import("firebase/firestore");
            const q = query(collection(db, "users", user.uid, "daily_records"));
            const snapshot = await getDocs(q);

            if (snapshot.size >= 5) {
                alert("記録は最大5件までです。新しい記録を作成するには既存の記録を解除するか、管理者にお問い合わせください。");
                setIsSubmitting(false);
                return;
            }

            const finalTags = [...tags];
            if (tagInput.trim() && !finalTags.includes(tagInput.trim())) {
                finalTags.push(tagInput.trim());
            }

            const recordData = {
                duration: dailyForm.duration,
                menu: dailyForm.menu,
                insight: dailyForm.insight,
                rating: rating,
                tags: finalTags,
                date: today,
                timestamp: serverTimestamp(),
            };

            // ユニークなIDで保存して上書きを防止
            await setDoc(doc(db, "users", user.uid, "daily_records", uniqueId), recordData);
            console.log("Daily record saved!");
            setShowDailyInput(false);
            setDailyForm({ duration: "", menu: "", insight: "" });
            setRating(0);
            setTags([]);
            setTagInput("");
        } catch (error) {
            console.error("Error saving daily record:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTimeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || isSubmitting) return;

        setIsSubmitting(true);

        try {
            const today = new Date().toISOString().split('T')[0];
            const timestamp = Date.now();
            const uniqueId = editingTime?.id || `time_${timestamp}`;

            const recordData = {
                stroke: timeForm.stroke,
                distance: timeForm.distance,
                time: timeForm.time,
                date: editingTime?.date || today,
                updatedAt: serverTimestamp(),
                timestamp: editingTime?.id ? undefined : serverTimestamp(), // Only for new records
            };

            await setDoc(doc(db, "users", user.uid, "swimming_times", uniqueId), recordData, { merge: true });
            console.log("Swimming time saved!");
            setShowTimeInput(false);
            setEditingTime(null);
            setTimeForm({ stroke: "", distance: "", time: "" });
            alert(editingTime ? "タイムを更新しました！" : "タイムを保存しました！");

            if (showTimeHistory) {
                fetchTimeHistory();
            }
        } catch (error) {
            console.error("Error saving time:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchTimeHistory = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { collection, query, getDocs, orderBy } = await import("firebase/firestore");
            const q = query(collection(db, "users", user.uid, "swimming_times"), orderBy("date", "desc"));
            const querySnapshot = await getDocs(q);
            const times: SwimmingTime[] = [];
            querySnapshot.forEach((doc) => {
                times.push({ id: doc.id, ...doc.data() } as SwimmingTime);
            });
            setTimeHistory(times);
            setShowTimeHistory(true);
        } catch (error) {
            console.error("Error fetching time history:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditTime = (time: SwimmingTime) => {
        setEditingTime(time);
        setTimeForm({
            stroke: time.stroke,
            distance: time.distance,
            time: time.time,
        });
        setShowTimeInput(true);
    };

    const fetchDailyHistory = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { collection, query, getDocs, orderBy } = await import("firebase/firestore");
            const q = query(collection(db, "users", user.uid, "daily_records"), orderBy("date", "desc"));
            const querySnapshot = await getDocs(q);
            const records: SavedDailyRecord[] = [];
            querySnapshot.forEach((doc) => {
                records.push(doc.data() as SavedDailyRecord);
            });
            setHistoryRecords(records);
            setShowDailyHistory(true);
            setHistorySearch(""); // Reset search when opening history
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput("");
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const runAIAnalysis = async () => {
        setIsSubmitting(true);
        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dailyForm),
            });

            // エラー時の詳細ログ出力
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Analysis API Error:", {
                    status: response.status,
                    statusText: response.statusText,
                    details: errorData
                });
                throw new Error(`Analysis failed (${response.status})`);
            }

            const result = await response.json();
            setAnalysisResult(result);
            setShowAIAnalysis(true);
        } catch (error: any) {
            console.error("AI Analysis Error:", error);
            alert(`AI解析に失敗しました。原因: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };


    // 日付を「2026年1月26日」の形式に変換する関数
    const formatDate = (dateValue: any) => {
        if (!dateValue) return "";
        let d: Date;
        if (dateValue.toDate) {
            d = dateValue.toDate();
        } else {
            d = new Date(dateValue);
        }
        if (isNaN(d.getTime())) return String(dateValue);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    };

    // News List Screen UI Content
    if (showNewsList) {
        return (
            <main className="min-h-screen bg-[#121212] text-white p-6 flex flex-col items-center">
                <div className="w-full max-w-md">
                    <header className="flex items-center mb-8">
                        <button
                            onClick={() => setShowNewsList(false)}
                            className="mr-3 p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            ←
                        </button>
                        <h2 className="text-2xl font-bold tracking-tight text-white/90">お知らせ</h2>
                    </header>

                    <div className="space-y-4">
                        {announcements.length > 0 ? (
                            announcements.map((news) => (
                                <div key={news.id} className="bg-[#1a1a1a] p-6 rounded-2xl border border-gray-800 shadow-xl border-l-4 border-l-blue-500">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-900/20 px-2 py-0.5 rounded">
                                            {news.type}
                                        </div>
                                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                            {formatDate(news.date)}
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-white/90 mb-3">{news.title}</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{news.content}</p>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20 bg-[#1a1a1a] rounded-2xl border border-gray-800 border-dashed">
                                <p className="text-gray-500 mb-2">📢</p>
                                <p className="text-gray-500 text-sm">新しいお知らせはありません</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#121212]">
                <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full"></div>
            </div>
        );
    }

    // Time Input Form
    if (showTimeInput) {
        return (
            <main className="min-h-screen bg-[#121212] text-white p-6 flex flex-col items-center justify-center">
                <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl border border-gray-800 shadow-2xl relative">
                    <button
                        onClick={() => setShowTimeInput(false)}
                        className="absolute top-4 left-4 text-gray-500 hover:text-white transition-colors p-2 text-xl"
                    >
                        ←
                    </button>
                    <div className="relative flex items-center justify-center mb-12 w-full">
                        <h2 className="text-2xl font-bold tracking-tight text-white/90 underline underline-offset-[12px] decoration-white/20 text-center">
                            {editingTime ? "タイムを編集" : "タイムを記録"}
                        </h2>
                    </div>

                    <form onSubmit={handleTimeSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-[0.2em] ml-1">種目</label>
                            <select
                                required
                                className="w-full bg-black/50 border border-gray-800 rounded-xl px-5 py-3 focus:ring-1 focus:ring-white outline-none transition-all"
                                value={timeForm.stroke}
                                onChange={(e) => setTimeForm({ ...timeForm, stroke: e.target.value })}
                            >
                                <option value="">選択してください</option>
                                <option value="自由形">自由形</option>
                                <option value="背泳ぎ">背泳ぎ</option>
                                <option value="平泳ぎ">平泳ぎ</option>
                                <option value="バタフライ">バタフライ</option>
                                <option value="個人メドレー">個人メドレー</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-[0.2em] ml-1">距離</label>
                            <select
                                required
                                className="w-full bg-black/50 border border-gray-800 rounded-xl px-5 py-3 focus:ring-1 focus:ring-white outline-none transition-all"
                                value={timeForm.distance}
                                onChange={(e) => setTimeForm({ ...timeForm, distance: e.target.value })}
                            >
                                <option value="">選択してください</option>
                                <option value="25m">25m</option>
                                <option value="50m">50m</option>
                                <option value="100m">100m</option>
                                <option value="200m">200m</option>
                                <option value="400m">400m</option>
                                <option value="800m">800m</option>
                                <option value="1500m">1500m</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-[0.2em] ml-1">タイム</label>
                            <input
                                required
                                type="text"
                                placeholder="例：1:05.42"
                                className="w-full bg-black/50 border border-gray-800 rounded-xl px-5 py-3 focus:ring-1 focus:ring-white outline-none transition-all placeholder:text-gray-700"
                                value={timeForm.time}
                                onChange={(e) => setTimeForm({ ...timeForm, time: e.target.value })}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full font-black py-4 rounded-xl mt-6 transition-all active:scale-[0.98] shadow-lg ${isSubmitting
                                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                                : "bg-white text-black hover:bg-gray-100"
                                }`}
                        >
                            {isSubmitting ? "保存中..." : editingTime ? "更新する" : "タイムを保存"}
                        </button>
                    </form>
                </div>
            </main>
        );
    }

    // Time History Screen (Personal Best)
    if (showTimeHistory) {
        return (
            <main className="min-h-screen bg-[#121212] text-white p-6 flex flex-col items-center">
                <div className="w-full max-w-md">
                    <header className="flex items-center mb-8">
                        <button
                            onClick={() => setShowTimeHistory(false)}
                            className="mr-3 p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            ←
                        </button>
                        <h2 className="text-2xl font-bold tracking-tight">自己ベスト</h2>
                    </header>

                    <div className="space-y-3">
                        {timeHistory.length > 0 ? (
                            timeHistory.map((time) => (
                                <button
                                    key={time.id}
                                    onClick={() => handleEditTime(time)}
                                    className="w-full bg-[#1a1a1a] p-5 rounded-2xl border border-gray-800 hover:border-white/20 transition-all flex justify-between items-center group active:scale-[0.98]"
                                >
                                    <div className="text-left">
                                        <div className="text-xs font-bold text-gray-500 mb-1">{time.date}</div>
                                        <div className="flex items-baseline space-x-2">
                                            <span className="text-lg font-bold text-white/90">{time.stroke}</span>
                                            <span className="text-sm text-gray-400">{time.distance}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-black text-blue-400 font-mono">{time.time}</div>
                                        <div className="text-[10px] text-gray-600 mt-1">タップして編集</div>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="text-center py-20 text-gray-500">
                                まだタイムの記録がありません
                            </div>
                        )}
                    </div>
                </div>
            </main>
        );
    }

    // About Modal
    if (showAbout) {
        return (
            <main className="min-h-screen bg-[#121212] text-white p-6 flex items-center justify-center">
                <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl border border-gray-800 shadow-2xl relative text-center animate-in fade-in zoom-in duration-300">
                    <button
                        onClick={() => setShowAbout(false)}
                        className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-2"
                    >
                        ✕
                    </button>
                    <h2 className="text-2xl font-bold mb-8 tracking-tight">このアプリについて</h2>

                    <div className="space-y-6 text-left max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="bg-black/30 p-5 rounded-xl border border-gray-800">
                            <p className="text-sm leading-relaxed text-gray-200">
                                <span className="font-bold text-white italic">swim note</span> は、水泳の練習を記録し、日々の振り返りを通して成長をサポートするアプリです。<br />
                                練習時間・メニュー・気づきを残すことで、自分の泳ぎを客観的に見直すことができます。
                            </p>
                        </div>

                        <div className="bg-black/30 p-5 rounded-xl border border-gray-800">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">主な機能</p>
                            <ul className="text-sm space-y-2 text-gray-300">
                                <li className="flex items-start">
                                    <span className="text-blue-500 mr-2">•</span>
                                    <span>今日の記録（練習時間・メニュー・気づき）</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="text-blue-500 mr-2">•</span>
                                    <span>日々の記録の確認</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="text-blue-500 mr-2">•</span>
                                    <span>タイム管理</span>
                                </li>
                            </ul>
                        </div>

                        <div className="bg-black/30 p-5 rounded-xl border border-gray-800">
                            <p className="text-sm text-gray-300">
                                初心者から競技者まで、すべてのスイマーが利用できます。
                            </p>
                        </div>

                        <div className="flex justify-between items-center px-2">
                            <span className="text-xs font-bold text-gray-600 tracking-widest uppercase">Version</span>
                            <span className="text-xs font-mono text-gray-500 bg-gray-800/50 px-2 py-1 rounded">1.0.0</span>
                        </div>

                        <div className="bg-black/30 p-5 rounded-xl border border-gray-800">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">お問い合わせ・ご要望</p>
                            <a
                                href="https://docs.google.com/forms/d/e/1FAIpQLSfie7XIFqEGEoErUAwMunNBZthBhXa1vLrpfoad013T4D38HA/viewform"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-400 hover:text-blue-300 transition-colors underline break-all leading-relaxed block"
                            >
                                https://docs.google.com/forms/d/e/1FAIpQLSfie7XIFqEGEoErUAwMunNBZthBhXa1vLrp...
                            </a>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowAbout(false)}
                        className="w-full font-bold py-3 rounded-lg mt-10 bg-white text-black hover:bg-gray-200 transition-all active:scale-95"
                    >
                        閉じる
                    </button>
                </div>
            </main>
        );
    }

    // Daily Record Input Form
    if (showDailyInput) {
        return (
            <main className="min-h-screen bg-[#121212] text-white p-6 flex flex-col items-center justify-center">
                <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl border border-gray-800 shadow-2xl relative">
                    <button
                        onClick={() => setShowDailyInput(false)}
                        className="absolute top-4 left-4 text-gray-500 hover:text-white transition-colors p-2 text-xl"
                    >
                        ←
                    </button>
                    <div className="relative flex items-center justify-center mb-12 w-full">
                        <h2 className="text-2xl font-bold tracking-tight text-white/90 underline underline-offset-[12px] decoration-white/20 text-center">今日の記録</h2>
                        <div className="absolute right-0 flex flex-col items-end">
                            <input
                                type="text"
                                placeholder="タグを追加..."
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleAddTag}
                                className="bg-transparent border-b border-gray-700 text-xs py-1 px-2 focus:border-white outline-none w-20 transition-all text-right placeholder:text-gray-600"
                            />
                            <div className="flex flex-wrap gap-1 mt-2 justify-end max-w-[120px]">
                                {tags.map(tag => (
                                    <span key={tag} className="text-[9px] bg-gray-800/80 text-gray-400 px-2 py-0.5 rounded-full flex items-center border border-gray-700">
                                        {tag}
                                        <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-white transition-colors">×</button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSimpleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-[0.2em] ml-1">練習時間</label>
                            <input
                                required
                                type="text"
                                placeholder="例：12:00～14:00"
                                className="w-full bg-black/50 border border-gray-800 rounded-xl px-5 py-3 focus:ring-1 focus:ring-white outline-none transition-all placeholder:text-gray-700"
                                value={dailyForm.duration}
                                onChange={(e) => setDailyForm({ ...dailyForm, duration: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-[0.2em] ml-1">メニュー</label>
                            <textarea
                                required
                                placeholder="今日のメニューを具体的に記入してください"
                                rows={4}
                                className="w-full bg-black/50 border border-gray-800 rounded-xl px-5 py-3 focus:ring-1 focus:ring-white outline-none transition-all placeholder:text-gray-700 resize-none"
                                value={dailyForm.menu}
                                onChange={(e) => setDailyForm({ ...dailyForm, menu: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-[0.2em] ml-1">今日の気づき</label>
                            <textarea
                                required
                                placeholder="今日の振り返りを記入してください"
                                rows={4}
                                className="w-full bg-black/50 border border-gray-800 rounded-xl px-5 py-3 focus:ring-1 focus:ring-white outline-none transition-all placeholder:text-gray-700 resize-none"
                                value={dailyForm.insight}
                                onChange={(e) => setDailyForm({ ...dailyForm, insight: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-400 mb-4 uppercase tracking-[0.2em] ml-1">自己評価</label>
                            <div className="flex justify-center space-x-4">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className={`text-3xl transition-all active:scale-125 ${star <= rating ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" : "text-gray-700 hover:text-gray-500"}`}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 pt-4">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`w-full font-black py-4 rounded-xl transition-all active:scale-[0.98] shadow-lg ${isSubmitting
                                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                                    : "bg-white text-black hover:bg-gray-100"
                                    }`}
                            >
                                {isSubmitting ? "保存中..." : "完了"}
                            </button>

                            <button
                                type="button"
                                disabled
                                className="w-full font-black py-4 rounded-xl transition-all bg-gray-800/50 text-gray-600 cursor-not-allowed flex items-center justify-center space-x-2 border border-white/5"
                            >
                                <span className="text-lg">🔒</span>
                                <span>AIコーチに分析してもらう</span>
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        );
    }

    // Daily History Screen
    if (showDailyHistory) {
        return (
            <main className="min-h-screen bg-[#121212] text-white p-6 flex flex-col items-center">
                <div className="w-full max-w-md">
                    <header className="flex flex-col mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <button
                                    onClick={() => {
                                        setShowDailyHistory(false);
                                        setSelectedHistoryItem(null);
                                        setHistorySearch("");
                                    }}
                                    className="mr-3 p-2 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    ←
                                </button>
                                <h2 className="text-2xl font-bold tracking-tight">日々の記録</h2>
                            </div>
                            {!selectedHistoryItem && (
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="タグで検索..."
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        className="bg-black/40 border border-gray-800 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-white outline-none w-32 transition-all placeholder:text-gray-600"
                                    />
                                    {historySearch && (
                                        <button
                                            onClick={() => setHistorySearch("")}
                                            className="absolute right-2 top-1.5 text-gray-500 hover:text-white"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </header>

                    {selectedHistoryItem ? (
                        <div className="bg-[#1a1a1a] p-8 rounded-2xl border border-gray-800 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-white/90">{selectedHistoryItem.date}</h3>
                                    <div className="text-yellow-400 mt-1">
                                        {"★".repeat(selectedHistoryItem.rating || 0)}{"☆".repeat(5 - (selectedHistoryItem.rating || 0))}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1 justify-end max-w-[150px]">
                                    {selectedHistoryItem.tags?.map(tag => (
                                        <span key={tag} className="text-[10px] bg-blue-900/40 text-blue-100 px-2 py-0.5 rounded-full border border-blue-800">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <section>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">練習時間</label>
                                    <p className="text-sm bg-black/30 p-3 rounded-lg border border-gray-800">{selectedHistoryItem.duration}</p>
                                </section>

                                <section>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">メニュー</label>
                                    <div className="text-sm bg-black/30 p-3 rounded-lg border border-gray-800 whitespace-pre-wrap leading-relaxed">
                                        {selectedHistoryItem.menu_fixed || selectedHistoryItem.menu}
                                    </div>
                                </section>

                                <section>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">気づき</label>
                                    <div className="text-sm bg-black/30 p-3 rounded-lg border border-gray-800 whitespace-pre-wrap leading-relaxed">
                                        {selectedHistoryItem.original_insight || selectedHistoryItem.insight}
                                    </div>
                                </section>

                                {(selectedHistoryItem.coach_comment) && (
                                    <section className="bg-blue-900/10 p-4 rounded-xl border border-blue-900/30">
                                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">AIコーチの一言</label>
                                        <p className="text-sm italic text-blue-100">「{selectedHistoryItem.coach_comment}」</p>
                                    </section>
                                )}
                            </div>

                            <button
                                onClick={() => setSelectedHistoryItem(null)}
                                className="w-full mt-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all"
                            >
                                一覧に戻る
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {(() => {
                                const filteredRecords = historyRecords.filter(record =>
                                    !historySearch || (record.tags && record.tags.some(tag => tag.includes(historySearch)))
                                );

                                if (filteredRecords.length > 0) {
                                    return filteredRecords.map((record, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedHistoryItem(record)}
                                            className="w-full bg-[#1a1a1a] p-5 rounded-2xl border border-gray-800 hover:border-white/20 transition-all flex flex-col group active:scale-[0.98]"
                                        >
                                            <div className="w-full flex justify-between items-start mb-3">
                                                <div className="text-left">
                                                    <div className="text-xs font-bold text-gray-500 mb-1">{record.date}</div>
                                                    <div className="text-yellow-400 text-sm">
                                                        {"★".repeat(record.rating || 0)}{"☆".repeat(5 - (record.rating || 0))}
                                                    </div>
                                                </div>
                                                <span className="text-gray-700 group-hover:text-white group-hover:translate-x-1 transition-all">→</span>
                                            </div>

                                            {record.tags && record.tags.length > 0 && (
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {record.tags.map(tag => (
                                                        <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-md border ${historySearch && tag.includes(historySearch) ? "bg-blue-900/40 border-blue-600 text-blue-100" : "bg-gray-800/50 border-gray-700/50 text-gray-400"}`}>
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                    ));
                                } else {
                                    return (
                                        <div className="text-center py-20 text-gray-500">
                                            {historySearch ? "該当する記録がありません" : "まだ記録がありません"}
                                        </div>
                                    );
                                }
                            })()}
                        </div>
                    )}
                </div>
            </main>
        );
    }

    // AI Analysis Screen
    if (showAIAnalysis && analysisResult) {
        return (
            <main className="min-h-screen bg-[#121212] text-white p-6 flex flex-col items-center justify-center">
                <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl border border-blue-900/40 shadow-2xl relative animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center justify-center mb-6 space-x-2">
                        <span className="text-xl">🤖</span>
                        <h2 className="text-xl font-bold tracking-tight text-blue-400">AIコーチの解析</h2>
                    </div>

                    <div className="space-y-6 mb-8">
                        <div className="bg-black/40 p-5 rounded-2xl border border-gray-800">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">練習時間</label>
                            <p className="text-sm">{dailyForm.duration}</p>
                        </div>

                        <div className="bg-black/40 p-5 rounded-2xl border border-gray-800">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">メニュー（AIが整理）</label>
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">{analysisResult.menu_fixed}</div>
                        </div>

                        <div className="bg-black/40 p-5 rounded-2xl border border-gray-800">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">今日の気づき</label>
                            <ul className="text-sm space-y-2">
                                {analysisResult.note_points.map((point, i) => (
                                    <li key={i} className="flex items-start">
                                        <span className="text-blue-500 mr-2">・</span>
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-blue-900/10 p-5 rounded-2xl border border-blue-900/30">
                            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">AIコーチの一言</label>
                            <p className="text-sm italic leading-relaxed text-blue-100">「{analysisResult.coach_comment}」</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setShowAIAnalysis(false)}
                            className="py-4 font-bold text-gray-400 hover:text-white transition-colors"
                        >
                            戻って修正
                        </button>
                        <button
                            onClick={() => handleDailySubmit(analysisResult)}
                            disabled={isSubmitting}
                            className="bg-white text-black py-4 rounded-xl font-black hover:bg-gray-200 transition-all active:scale-95"
                        >
                            これで保存
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    // Profile Display
    if (showProfileDisplay && profile) {
        return (
            <main className="min-h-screen bg-[#121212] text-white p-6 flex items-center justify-center">
                <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl border border-gray-800 shadow-2xl relative animate-in fade-in zoom-in duration-300">
                    <button
                        onClick={() => setShowProfileDisplay(false)}
                        className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-2"
                    >
                        ✕
                    </button>
                    <h2 className="text-2xl font-bold mb-8 text-center tracking-tight">ユーザープロフィール</h2>

                    <div className="space-y-6">
                        <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">ニックネーム</p>
                            <p className="text-lg font-medium">{profile.nickname}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">年齢</p>
                                <p className="text-lg font-medium">{profile.age} 歳</p>
                            </div>
                            <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">性別</p>
                                <p className="text-lg font-medium">
                                    {profile.gender === 'male' ? '男性' : profile.gender === 'female' ? '女性' : 'その他'}
                                </p>
                            </div>
                        </div>

                        <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">主な泳法</p>
                            <p className="text-lg font-medium">
                                {profile.stroke === 'crawl' ? '自由形' :
                                    profile.stroke === 'back' ? '背泳ぎ' :
                                        profile.stroke === 'breast' ? '平泳ぎ' :
                                            profile.stroke === 'fly' ? 'バタフライ' : '個人メドレー'}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">身長</p>
                                <p className="text-lg font-medium">{profile.height} cm</p>
                            </div>
                            <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">体重</p>
                                <p className="text-lg font-medium">{profile.weight} kg</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setShowProfileDisplay(false);
                            setShowProfileEdit(true);
                        }}
                        className="w-full font-bold py-4 rounded-xl mt-10 bg-white text-black hover:bg-gray-200 transition-all active:scale-95 shadow-lg"
                    >
                        プロフィールを編集
                    </button>
                </div>
            </main>
        );
    }

    // Login Info Display
    if (showLoginDisplay && user) {
        return (
            <main className="min-h-screen bg-[#121212] text-white p-6 flex items-center justify-center">
                <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl border border-gray-800 shadow-2xl relative animate-in fade-in zoom-in duration-300">
                    <button
                        onClick={() => setShowLoginDisplay(false)}
                        className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-2"
                    >
                        ✕
                    </button>
                    <h2 className="text-2xl font-bold mb-8 text-center tracking-tight">ログイン情報</h2>

                    <div className="space-y-6">
                        <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">メールアドレス</p>
                            <p className="text-lg font-medium">{user.email}</p>
                        </div>

                        <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">パスワード</p>
                            <p className="text-lg font-medium">••••••••</p>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setShowLoginDisplay(false);
                            setShowLoginEdit(true);
                        }}
                        className="w-full font-bold py-4 rounded-xl mt-10 bg-white text-black hover:bg-gray-200 transition-all active:scale-95 shadow-lg"
                    >
                        ログイン情報を編集
                    </button>
                </div>
            </main>
        );
    }

    // Login Info Edit
    if (showLoginEdit && user) {
        return (
            <main className="min-h-screen bg-[#121212] text-white p-6 flex items-center justify-center">
                <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl border border-gray-800 shadow-2xl relative">
                    <button
                        onClick={() => setShowLoginEdit(false)}
                        className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-2"
                    >
                        ✕
                    </button>
                    <h2 className="text-2xl font-bold mb-8 text-center tracking-tight">ログイン情報編集</h2>

                    <div className="space-y-8">
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            handleEmailUpdate(formData.get("email") as string);
                        }} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">メールアドレス</label>
                                <input
                                    name="email"
                                    type="email"
                                    defaultValue={user.email || ""}
                                    required
                                    className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-2 bg-gray-800 text-white rounded-lg text-sm font-bold hover:bg-gray-700 transition-all"
                            >
                                メールアドレスを変更
                            </button>
                        </form>

                        <div className="h-[1px] bg-gray-800 w-full"></div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const pass = formData.get("password") as string;
                            const confirm = formData.get("confirm") as string;
                            if (pass !== confirm) return alert("パスワードが一致しません");
                            handlePasswordUpdate(pass);
                        }} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">新しいパスワード</label>
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">新しいパスワード（確認）</label>
                                <input
                                    name="confirm"
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-2 bg-gray-800 text-white rounded-lg text-sm font-bold hover:bg-gray-700 transition-all"
                            >
                                パスワードを変更
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        );
    }

    // Profile Setup Form
    if (needsSetup || (showProfileEdit && user)) {
        return (
            <main className="min-h-screen bg-[#121212] text-white p-6 flex items-center justify-center">
                <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl border border-gray-800 shadow-2xl relative">
                    {!needsSetup && (
                        <button
                            onClick={() => setShowProfileEdit(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                        >
                            ✕
                        </button>
                    )}
                    <h2 className="text-2xl font-bold mb-6 text-center tracking-tight">
                        {needsSetup ? "アカウント設定" : "プロフィール編集"}
                    </h2>
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">ニックネーム</label>
                            <input
                                required
                                type="text"
                                className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all"
                                value={formData.nickname}
                                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">年齢</label>
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    max="120"
                                    className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all"
                                    value={formData.age}
                                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">性別</label>
                                <select
                                    required
                                    className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all"
                                    value={formData.gender}
                                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                >
                                    <option value="">選択</option>
                                    <option value="male">男性</option>
                                    <option value="female">女性</option>
                                    <option value="other">その他</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">主な泳法</label>
                            <select
                                required
                                className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all"
                                value={formData.stroke}
                                onChange={(e) => setFormData({ ...formData, stroke: e.target.value })}
                            >
                                <option value="">選択してください</option>
                                <option value="crawl">自由形</option>
                                <option value="back">背泳ぎ</option>
                                <option value="breast">平泳ぎ</option>
                                <option value="fly">バタフライ</option>
                                <option value="im">個人メドレー</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">身長 (cm)</label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    step="0.1"
                                    className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all"
                                    value={formData.height}
                                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">体重 (kg)</label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    step="0.1"
                                    className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all"
                                    value={formData.weight}
                                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full font-bold py-3 rounded-lg mt-4 transition-all active:scale-95 ${isSubmitting
                                ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                                : "bg-white text-black hover:bg-gray-200"
                                }`}
                        >
                            {isSubmitting ? "保存中..." : "設定を完了する"}
                        </button>
                    </form>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#121212] text-white p-6">
            <div className="max-w-md mx-auto">
                <header className="flex justify-between items-center mb-10">
                    <h1 className="text-2xl font-bold tracking-tighter italic">swim note</h1>
                    <button
                        onClick={handleOpenNewsList}
                        className="text-xs font-bold bg-[#1a1a1a] px-4 py-2 rounded-full border border-gray-800 hover:bg-white/10 transition-colors flex items-center space-x-2"
                    >
                        <span>お知らせ</span>
                        {hasUnreadNews && (
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                        )}
                    </button>
                </header>

                {showSettings ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-xl font-bold mb-6 flex items-center">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="mr-3 p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                ←
                            </button>
                            設定
                        </h2>
                        <div className="bg-[#1a1a1a] rounded-2xl border border-gray-800 overflow-hidden">
                            <SettingsItem label="アカウント設定" onClick={() => setShowProfileDisplay(true)} />
                            <SettingsItem label="ログイン情報" onClick={() => setShowLoginDisplay(true)} />
                            <SettingsItem
                                label="タイム記入"
                                onClick={() => {
                                    setEditingTime(null);
                                    setTimeForm({ stroke: "", distance: "", time: "" });
                                    setShowTimeInput(true);
                                }}
                            />
                            <SettingsItem label="通知" locked onClick={() => { }} />
                            <SettingsItem label="このアプリについて" onClick={() => setShowAbout(true)} />
                            <SettingsItem
                                label="ログアウト"
                                destructive
                                onClick={handleLogout}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-5 animate-in fade-in duration-700">
                        <MenuBox title="今日の記録" onClick={() => setShowDailyInput(true)} />
                        <MenuBox title="日々の記録" onClick={fetchDailyHistory} />
                        <MenuBox title="自己ベスト" onClick={fetchTimeHistory} />
                        <MenuBox title="ストレッチ" locked onClick={() => { }} />
                        <MenuBox title="泳法研究" locked onClick={() => { }} />
                        <MenuBox title="設定" onClick={() => setShowSettings(true)} />
                    </div>
                )}
            </div>
        </main>
    );
}

function MenuBox({ title, onClick, locked = false }: { title: string; onClick: () => void; locked?: boolean }) {
    return (
        <div
            onClick={locked ? undefined : onClick}
            className={`aspect-square bg-[#1a1a1a] rounded-xl border border-gray-800 flex flex-col items-center justify-center p-4 transition-all relative overflow-hidden ${locked ? "cursor-not-allowed opacity-60" : "hover:border-white/30 active:scale-95 cursor-pointer group shadow-2xl"
                }`}
        >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            {locked && (
                <span className="text-lg mb-2">🔒</span>
            )}
            <span className={`text-sm font-black tracking-[0.15em] transition-colors duration-300 ${locked ? "text-gray-600" : "text-gray-400 group-hover:text-white"
                }`}>
                {title}
            </span>
            {!locked && (
                <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-white group-hover:w-full transition-all duration-500" />
            )}
        </div>
    );
}

function SettingsItem({
    label,
    onClick,
    destructive = false,
    locked = false,
}: {
    label: string;
    onClick: () => void;
    destructive?: boolean;
    locked?: boolean;
}) {
    return (
        <button
            onClick={locked ? undefined : onClick}
            disabled={locked}
            className={`w-full px-6 py-4 text-left border-b border-gray-800 last:border-b-0 transition-colors flex justify-between items-center group ${destructive ? "text-red-500" : "text-gray-300"} ${locked ? "opacity-50 cursor-not-allowed" : "hover:bg-white/5"}`}
        >
            <div className="flex items-center">
                <span className="font-medium">{label}</span>
                {locked && <span className="ml-2 text-xs">🔒</span>}
            </div>
            <span className={`text-gray-600 group-hover:translate-x-1 transition-transform ${destructive ? "text-red-900/50" : ""} ${locked ? "hidden" : ""}`}>
                →
            </span>
        </button>
    );
}