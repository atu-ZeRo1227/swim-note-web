"use client";

import { useEffect, useState } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User, reauthenticateWithCredential, EmailAuthProvider, updateEmail, updatePassword, deleteUser, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, getDocs, serverTimestamp, collection, query, orderBy, limit, onSnapshot, collectionGroup, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";

interface Profile {
    nickname: string;
    age: string;
    stroke: string;
    height: string;
    weight: string;
    gender: string;
    iconUrl?: string;
    bio?: string;
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
    photoUrl?: string;
    timestamp?: any;
}

interface SwimmingTime {
    id?: string;
    stroke: string;
    distance: string;
    time: string;
    poolType: "long" | "short";
    date?: string;
    timestamp?: any;
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
    const [isEmailUnverified, setIsEmailUnverified] = useState(false);

    const [showSettings, setShowSettings] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Form states
    const [formData, setFormData] = useState<Profile>({
        nickname: "",
        age: "",
        stroke: "",
        height: "",
        weight: "",
        gender: "",
        bio: "",
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showProfileDisplay, setShowProfileDisplay] = useState(false);
    const [showProfileEdit, setShowProfileEdit] = useState(false);
    const [showLoginDisplay, setShowLoginDisplay] = useState(false);
    const [showLoginEdit, setShowLoginEdit] = useState(false);
    const [showAccountEdit, setShowAccountEdit] = useState(false);
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
    const [menuPhoto, setMenuPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [menuInputMode, setMenuInputMode] = useState<"text" | "photo">("text");
    const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
    const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);

    const [showTimeInput, setShowTimeInput] = useState(false);
    const [showTimeHistory, setShowTimeHistory] = useState(false);
    const [showCommunity, setShowCommunity] = useState(false);
    const [showFriends, setShowFriends] = useState(false);
    const [showCommunityPostInput, setShowCommunityPostInput] = useState(false);
    const [communityTab, setCommunityTab] = useState<"following" | "all">("all");
    const [communityPostForm, setCommunityPostForm] = useState({ text: "", visibility: "all" as "all" | "followers" });
    const [communityPhoto, setCommunityPhoto] = useState<File | null>(null);
    const [communityPhotoPreview, setCommunityPhotoPreview] = useState<string | null>(null);
    const [followingList, setFollowingList] = useState<string[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [communityPosts, setCommunityPosts] = useState<any[]>([]);
    const [likesData, setLikesData] = useState<{ [key: string]: { count: number, liked: boolean } }>({});
    const [commentsData, setCommentsData] = useState<{ [key: string]: any[] }>({});
    const [showCommentsForPost, setShowCommentsForPost] = useState<string | null>(null);
    const [newComment, setNewComment] = useState("");
    const [timeHistory, setTimeHistory] = useState<SwimmingTime[]>([]);
    const [editingTime, setEditingTime] = useState<SwimmingTime | null>(null);

    const [timeForm, setTimeForm] = useState<SwimmingTime>({
        stroke: "",
        distance: "",
        time: "",
        poolType: "short",
    });

    // Friends and Search states
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showUserSearch, setShowUserSearch] = useState(false);
    const [showRequestList, setShowRequestList] = useState(false);
    const [viewingUser, setViewingUser] = useState<any | null>(null);
    const [followRequests, setFollowRequests] = useState<any[]>([]);
    const [sentRequestUids, setSentRequestUids] = useState<string[]>([]);
    const [recommendedUsers, setRecommendedUsers] = useState<any[]>([]);
    const [mutualFollows, setMutualFollows] = useState<string[]>([]);

    const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);

    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [showNewsList, setShowNewsList] = useState(false);
    const [hasUnreadNews, setHasUnreadNews] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showAccountDeleteConfirm, setShowAccountDeleteConfirm] = useState(false);
    const [emailForm, setEmailForm] = useState({ currentPassword: "", newEmail: "", newPassword: "" });

    useEffect(() => {
        let isMounted = true;

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                if (isMounted) setUser(currentUser);

                // メール認証チェック (Google等のプロバイダはスキップ)
                const isEmailUser = currentUser.providerData.some(p => p.providerId === "password");
                if (isEmailUser && !currentUser.emailVerified) {
                    if (isMounted) {
                        setIsEmailUnverified(true);
                        setLoading(false);
                    }
                    return;
                } else {
                    if (isMounted) setIsEmailUnverified(false);
                }

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
        if (!user) return;
        const q = query(collection(db, "users", user.uid, "daily_records"), orderBy("date", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const records: SavedDailyRecord[] = [];
            snapshot.forEach((doc) => {
                records.push(doc.data() as SavedDailyRecord);
            });
            setHistoryRecords(records);
        });
        return () => unsubscribe();
    }, [user]);

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

    const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setProfilePhoto(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
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
            let iconUrl = profile?.iconUrl || "";
            if (profilePhoto) {
                const iconRef = ref(storage, `users/${user.uid}/profile_icon`);
                await uploadBytes(iconRef, profilePhoto);
                iconUrl = await getDownloadURL(iconRef);
            }

            const profileData = {
                ...formData,
                iconUrl,
                updatedAt: serverTimestamp(),
            };

            console.log("Saving profile for user:", user.uid, profileData);
            // Firestoreに「users」コレクションとしてプロファイル情報を保存します
            await setDoc(doc(db, "users", user.uid), profileData, { merge: true });
            console.log("Profile saved successfully to Firestore!");

            // 保存成功後に状態を更新
            setProfile({ ...formData, iconUrl });
            setNeedsSetup(false);
            setShowProfileEdit(false);
            setShowAccountEdit(false);
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

            let photoUrl = "";
            if (menuPhoto) {
                const photoRef = ref(storage, `users/${user.uid}/daily_records/${uniqueId}_${menuPhoto.name}`);
                await uploadBytes(photoRef, menuPhoto);
                photoUrl = await getDownloadURL(photoRef);
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
                photoUrl: photoUrl || null,
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
            setMenuPhoto(null);
            setPhotoPreview(null);
        } catch (error: any) {
            console.error("Error saving daily record:", error);
            alert("保存に失敗しました: " + (error.message || error));
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

            let photoUrl = "";
            if (menuPhoto) {
                const photoRef = ref(storage, `users/${user.uid}/daily_records/${uniqueId}_${menuPhoto.name}`);
                const uploadTask = uploadBytes(photoRef, menuPhoto);
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("写真のアップロードがタイムアウトしました。Firebase Storageが有効になっていないか、通信環境が不安定です。")), 15000)
                );

                await Promise.race([uploadTask, timeoutPromise]);
                photoUrl = await getDownloadURL(photoRef);
            }

            const recordData = {
                duration: dailyForm.duration,
                menu: dailyForm.menu,
                insight: dailyForm.insight,
                rating: rating,
                tags: finalTags,
                date: today,
                timestamp: serverTimestamp(),
                photoUrl: photoUrl || null,
            };

            // ユニークなIDで保存して上書きを防止
            await setDoc(doc(db, "users", user.uid, "daily_records", uniqueId), recordData);
            console.log("Daily record saved!");
            setShowDailyInput(false);
            setDailyForm({ duration: "", menu: "", insight: "" });
            setRating(0);
            setTags([]);
            setTagInput("");
            setMenuPhoto(null);
            setPhotoPreview(null);
        } catch (error: any) {
            console.error("Error saving daily record:", error);
            alert("保存に失敗しました: " + (error.message || error));
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

            const recordData: any = {
                stroke: timeForm.stroke,
                distance: timeForm.distance,
                time: timeForm.time,
                poolType: timeForm.poolType,
                date: editingTime?.date || today,
                updatedAt: serverTimestamp(),
                timestamp: editingTime?.timestamp || serverTimestamp(),
            };

            await setDoc(doc(db, "users", user.uid, "swimming_times", uniqueId), recordData, { merge: true });
            console.log("Swimming time saved!");
            setShowTimeInput(false);
            setEditingTime(null);
            setTimeForm({ stroke: "", distance: "", time: "", poolType: "short" });
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

    const handleDeleteTime = (timeToDelete?: SwimmingTime) => {
        const target = timeToDelete || editingTime;
        if (!target || !target.id) return;
        setEditingTime(target);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!user || !editingTime?.id || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, "users", user.uid, "swimming_times", editingTime.id));
            setTimeHistory((prev) => prev.filter((t) => t.id !== editingTime.id));
            setShowDeleteConfirm(false);
            setShowTimeInput(false);
            setEditingTime(null);
            setTimeForm({ stroke: "", distance: "", time: "", poolType: "short" });
        } catch (error: any) {
            console.error("Delete error:", error);
            alert(`削除に失敗しました: ${error.message || "不明なエラー"}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const usersSnap = await getDocs(collection(db, "users"));
            const users = usersSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAllUsers(users);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    const fetchFollowingList = async (uid: string) => {
        try {
            const followingSnap = await getDocs(collection(db, "users", uid, "following"));
            const list = followingSnap.docs.map(doc => doc.id);
            setFollowingList(list);
        } catch (error) {
            console.error("Error fetching following list:", error);
        }
    };

    const handleFollow = async (targetUid: string) => {
        if (!user) return;
        try {
            const isFollowing = followingList.includes(targetUid);
            const followingRef = doc(db, "users", user.uid, "following", targetUid);
            if (isFollowing) {
                await deleteDoc(followingRef);
                setFollowingList(prev => prev.filter(id => id !== targetUid));
            } else {
                await setDoc(followingRef, { timestamp: serverTimestamp() });
                setFollowingList(prev => [...prev, targetUid]);
            }
        } catch (error) {
            console.error("Error toggling follow:", error);
        }
    };

    const handleCommunityPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCommunityPhoto(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setCommunityPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSearchUsers = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;

        try {
            // Search by UID (Exact)
            const uidDoc = await getDoc(doc(db, "users", searchQuery.trim()));
            let results: any[] = [];
            if (uidDoc.exists()) {
                results.push({ id: uidDoc.id, ...uidDoc.data() });
            }

            // Search by Nickname (Simple match)
            const q = query(collection(db, "users"), where("nickname", ">=", searchQuery), where("nickname", "<=", searchQuery + "\uf8ff"), limit(10));
            const nicknameSnap = await getDocs(q);
            nicknameSnap.forEach(doc => {
                if (!results.some(r => r.id === doc.id)) {
                    results.push({ id: doc.id, ...doc.data() });
                }
            });

            setSearchResults(results);
        } catch (error) {
            console.error("Search error:", error);
        }
    };

    const fetchFollowRequests = async () => {
        if (!user) return;
        try {
            const q = query(collection(db, "users", user.uid, "follow_requests"), limit(20));
            const snap = await getDocs(q);
            const requests = await Promise.all(snap.docs.map(async (requestDoc) => {
                const uDoc = await getDoc(doc(db, "users", requestDoc.id));
                return { id: requestDoc.id, ...(uDoc.data() || {}) };
            }));
            setFollowRequests(requests);
        } catch (error) {
            console.error("Error fetching requests:", error);
        }
    };

    const handleSendFollowRequest = async (targetUid: string) => {
        if (!user) return;
        try {
            const requestRef = doc(db, "users", targetUid, "follow_requests", user.uid);
            if (sentRequestUids.includes(targetUid)) {
                // Cancel request
                await deleteDoc(requestRef);
                setSentRequestUids(prev => prev.filter(id => id !== targetUid));
                alert("フォローリクエストを取り消しました");
            } else {
                // Send request
                await setDoc(requestRef, {
                    timestamp: serverTimestamp(),
                    status: "pending"
                });
                setSentRequestUids(prev => [...prev, targetUid]);
                alert("フォローリクエストを送信しました！");
            }
        } catch (error) {
            console.error("Error toggling request:", error);
        }
    };

    const handleAcceptRequest = async (requesterUid: string) => {
        if (!user) return;
        try {
            // Add to following of requester
            await setDoc(doc(db, "users", requesterUid, "following", user.uid), { timestamp: serverTimestamp() });
            // Add to following of user (mutual follow)
            await setDoc(doc(db, "users", user.uid, "following", requesterUid), { timestamp: serverTimestamp() });
            // Delete request
            await deleteDoc(doc(db, "users", user.uid, "follow_requests", requesterUid));

            setFollowingList(prev => [...prev, requesterUid]);
            fetchFollowRequests();
            alert("リクエストを承認しました！");
        } catch (error) {
            console.error("Error accepting request:", error);
        }
    };

    const fetchRecommendations = async () => {
        if (!user) return;
        try {
            // 1. Get mutual friends (people I follow who also follow me)
            // Note: In this simple implementation, we'll check our following list
            // and see if they have us in their following list (if data structure allowed)
            // or just pick some interesting users.

            // To strictly follow: "followings of mutual friends"
            // For now, let's get the users we follow
            const followingSnap = await getDocs(collection(db, "users", user.uid, "following"));
            const myFollowing = followingSnap.docs.map(d => d.id);

            let potentialRecs: string[] = [];

            // For each person I follow, get a few people they follow
            for (const followedUid of myFollowing.slice(0, 5)) { // Limit to first 5 friends for performance
                const subFollowingSnap = await getDocs(query(collection(db, "users", followedUid, "following"), limit(5)));
                subFollowingSnap.docs.forEach(d => {
                    if (d.id !== user.uid && !myFollowing.includes(d.id)) {
                        potentialRecs.push(d.id);
                    }
                });
            }

            // Deduplicate
            const uniqueRecs = Array.from(new Set(potentialRecs)).slice(0, 20);

            let recUsers: any[] = [];
            if (uniqueRecs.length > 0) {
                const recsSnap = await Promise.all(uniqueRecs.map(uid => getDoc(doc(db, "users", uid))));
                recUsers = recsSnap.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() }));
            }

            // Fallback to random users if not enough recommendations
            if (recUsers.length < 5) {
                const q = query(collection(db, "users"), limit(30));
                const snap = await getDocs(q);
                const randomUsers = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(u => u.id !== user.uid && !myFollowing.includes(u.id) && !recUsers.some(r => r.id === u.id));
                recUsers = [...recUsers, ...randomUsers].slice(0, 20);
            }

            setRecommendedUsers(recUsers);
        } catch (error) {
            console.error("Error fetching recommendations:", error);
        }
    };

    const handleCommunityPostSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || isSubmitting) return;
        if (!communityPostForm.text.trim() && !communityPhoto) {
            alert("内容を入力するか、写真を選択してください。");
            return;
        }

        setIsSubmitting(true);
        try {
            const timestamp = Date.now();
            const postId = `post_${timestamp}`;

            let photoUrl = "";
            if (communityPhoto) {
                const photoRef = ref(storage, `users/${user.uid}/community_posts/${postId}_${communityPhoto.name}`);
                await uploadBytes(photoRef, communityPhoto);
                photoUrl = await getDownloadURL(photoRef);
            }

            const postData = {
                text: communityPostForm.text,
                photoUrl: photoUrl || null,
                visibility: communityPostForm.visibility,
                timestamp: serverTimestamp(),
                date: new Date().toISOString().split('T')[0],
            };

            await setDoc(doc(db, "users", user.uid, "community_posts", postId), postData);

            setShowCommunityPostInput(false);
            setCommunityPostForm({ text: "", visibility: "all" });
            setCommunityPhoto(null);
            setCommunityPhotoPreview(null);
            fetchCommunityPosts();
        } catch (error) {
            console.error("Error posting to community:", error);
            alert("投稿に失敗しました。");
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchCommunityPosts = async () => {
        try {
            const postsQuery = query(collectionGroup(db, "community_posts"), orderBy("timestamp", "desc"), limit(50));
            const postsSnap = await getDocs(postsQuery);

            // Get all user IDs involved to fetch their profiles once
            const userIds = Array.from(new Set(postsSnap.docs.map(doc => doc.ref.parent.parent?.id).filter(Boolean)));
            const userProfiles: { [key: string]: any } = {};

            await Promise.all(userIds.map(async (id) => {
                const uDoc = await getDoc(doc(db, "users", id as string));
                if (uDoc.exists()) {
                    userProfiles[id as string] = uDoc.data();
                }
            }));

            const posts = postsSnap.docs.map((recordDoc) => {
                const data = recordDoc.data();
                const userId = recordDoc.ref.parent.parent?.id;
                const profile = userId ? userProfiles[userId] : null;

                return {
                    id: recordDoc.id,
                    userId,
                    nickname: profile?.nickname || "匿名ユーザー",
                    iconUrl: profile?.iconUrl || null,
                    ...data
                };
            });
            setCommunityPosts(posts);
            // Fetch likes and comments count for these posts
            posts.forEach(post => {
                if (post.userId) {
                    fetchLikesForPost(post.id, post.userId);
                    fetchComments(post.id, post.userId);
                }
            });
        } catch (error: any) {
            console.error("Error fetching community posts:", error);
            if (error.message && error.message.includes("index")) {
                alert("コミュニティ機能の利用には、Firestoreのインデックス作成が必要です。コンソールで作成してください。");
            }
        }
    };

    const handleToggleLike = async (postId: string, authorId: string) => {
        if (!user || !authorId) return;
        const likeRef = doc(db, "users", authorId, "community_posts", postId, "likes", user.uid);

        try {
            const likeDoc = await getDoc(likeRef);
            if (likeDoc.exists()) {
                await deleteDoc(likeRef);
            } else {
                await setDoc(likeRef, { timestamp: serverTimestamp() });
            }
            fetchLikesForPost(postId, authorId);
        } catch (error) {
            console.error("Error toggling like:", error);
        }
    };

    const fetchLikesForPost = async (postId: string, authorId: string) => {
        if (!authorId) return;
        try {
            const likesSnap = await getDocs(collection(db, "users", authorId, "community_posts", postId, "likes"));
            const count = likesSnap.size;
            const liked = user ? likesSnap.docs.some(doc => doc.id === user.uid) : false;
            setLikesData(prev => ({ ...prev, [postId]: { count, liked } }));
        } catch (error) {
            console.error("Error fetching likes:", error);
        }
    };

    const fetchComments = async (postId: string, authorId: string) => {
        if (!authorId) return;
        try {
            const commentsSnap = await getDocs(query(collection(db, "users", authorId, "community_posts", postId, "comments"), orderBy("timestamp", "asc")));
            const comments = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCommentsData(prev => ({ ...prev, [postId]: comments }));
        } catch (error) {
            console.error("Error fetching comments:", error);
        }
    };

    const handleAddComment = async (postId: string, authorId: string) => {
        if (!user || !newComment.trim()) return;
        try {
            const commentRef = collection(db, "users", authorId, "community_posts", postId, "comments");
            const newCommentDoc = doc(commentRef);
            await setDoc(newCommentDoc, {
                userId: user.uid,
                nickname: profile?.nickname || "匿名ユーザー",
                text: newComment,
                timestamp: serverTimestamp()
            });
            setNewComment("");
            fetchComments(postId, authorId);
        } catch (error) {
            console.error("Error adding comment:", error);
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!user) return;
        if (!confirm("投稿を削除してもよろしいですか？")) return;
        try {
            await deleteDoc(doc(db, "users", user.uid, "community_posts", postId));
            setCommunityPosts(prev => prev.filter(p => p.id !== postId));
        } catch (error) {
            console.error("Error deleting post:", error);
            alert("削除に失敗しました。");
        }
    };

    useEffect(() => {
        if (showCommunity) {
            fetchCommunityPosts();
            if (user) fetchFollowingList(user.uid);
        }
    }, [showCommunity, user]);

    useEffect(() => {
        if (showFriends) {
            fetchAllUsers();
            fetchFollowRequests();
            fetchRecommendations();
            if (user) fetchFollowingList(user.uid);
        }
    }, [showFriends, user]);

    const fetchTimeHistory = async () => {
        if (!user) return;
        try {
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
        }
    };

    const handleEditTime = (time: SwimmingTime) => {
        console.log("Editing time:", time);
        setEditingTime(time);
        setTimeForm({
            stroke: time.stroke,
            distance: time.distance,
            time: time.time,
            poolType: time.poolType || "short",
        });
        setShowTimeInput(true);
    };

    const fetchDailyHistory = async () => {
        if (!user) return;
        setShowDailyHistory(true);
        setHistorySearch("");
    };

    const handleUpdateLoginInfo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const credential = EmailAuthProvider.credential(user.email!, emailForm.currentPassword);
            await reauthenticateWithCredential(user, credential);

            if (emailForm.newEmail && emailForm.newEmail !== user.email) {
                await updateEmail(user, emailForm.newEmail);
            }
            if (emailForm.newPassword) {
                await updatePassword(user, emailForm.newPassword);
            }

            alert("ログイン情報を更新しました。");
            setShowLoginEdit(false);
            setEmailForm({ currentPassword: "", newEmail: "", newPassword: "" });
        } catch (error: any) {
            console.error("Update login error:", error);
            alert(`更新に失敗しました: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!user || isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Firestoreのユーザーデータを削除
            await deleteDoc(doc(db, "users", user.uid));

            // アカウントを削除
            await deleteUser(user);

            alert("アカウントを削除しました。");
            router.push("/login");
        } catch (error: any) {
            console.error("Delete account error:", error);
            if (error.code === "auth/requires-recent-login") {
                alert("セキュリティ保護のため、再ログインしてから再度お試しください。");
            } else {
                alert(`削除に失敗しました: ${error.message}`);
            }
        } finally {
            setIsSubmitting(false);
            setShowAccountDeleteConfirm(false);
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

    const resetToHome = () => {
        setShowNewsList(false);
        setShowTimeInput(false);
        setShowTimeHistory(false);
        setShowAbout(false);
        setShowDailyInput(false);
        setShowDailyHistory(false);
        setShowAIAnalysis(false);
        setShowProfileDisplay(false);
        setShowLoginDisplay(false);
        setShowProfileEdit(false);
        setShowLoginEdit(false);
        setShowSettings(false);
        setShowCommunity(false);
        setShowFriends(false);
        setShowCommunityPostInput(false);
        setNeedsSetup(false);
        setShowUserSearch(false);
        setShowRequestList(false);
        setViewingUser(null);
        setIsEmailUnverified(false);
    };

    const renderContent = () => {
        // Verification Required Screen
        if (isEmailUnverified) {
            return (
                <main className="min-h-screen bg-[#121212] text-white p-6 flex items-center justify-center text-center">
                    <div className="w-full max-w-md bg-[#1a1a1a] p-10 rounded-3xl border border-gray-800 shadow-2xl animate-in fade-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                            <span className="text-4xl">📧</span>
                        </div>
                        <h2 className="text-2xl font-bold mb-4">メール認証が必要です</h2>
                        <p className="text-gray-400 text-sm mb-10 leading-relaxed">
                            ご登録いただいたメールアドレスに認証メールを送信しました。<br />
                            メール内のリンクをクリックして、アカウントを有効化してください。
                        </p>
                        <div className="space-y-4">
                            <button
                                onClick={async () => {
                                    await auth.currentUser?.reload();
                                    if (auth.currentUser?.emailVerified) {
                                        window.location.reload();
                                    } else {
                                        alert("まだ認証が完了していないようです。メールを確認してください。");
                                    }
                                }}
                                className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
                            >
                                認証しました（再読み込み）
                            </button>
                            <button
                                onClick={() => {
                                    signOut(auth);
                                    router.push("/login");
                                }}
                                className="w-full bg-transparent text-gray-500 font-bold py-2 rounded-2xl hover:text-white transition-all text-sm"
                            >
                                ログアウトして戻る
                            </button>
                        </div>
                    </div>
                </main>
            );
        }

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
                                    disabled={!!editingTime}
                                    className="w-full bg-black/50 border border-gray-800 rounded-xl px-5 py-3 focus:ring-1 focus:ring-white outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                                <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-[0.2em] ml-1">水路</label>
                                <div className="flex bg-black/50 p-1 rounded-xl border border-gray-800">
                                    <button
                                        type="button"
                                        onClick={() => setTimeForm({ ...timeForm, poolType: "short" })}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${timeForm.poolType === "short" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
                                    >
                                        短水路 (25m)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTimeForm({ ...timeForm, poolType: "long" })}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${timeForm.poolType === "long" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
                                    >
                                        長水路 (50m)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-[0.2em] ml-1">距離</label>
                                <select
                                    required
                                    disabled={!!editingTime}
                                    className="w-full bg-black/50 border border-gray-800 rounded-xl px-5 py-3 focus:ring-1 focus:ring-white outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

                            <div className="flex space-x-3 mt-6">
                                {editingTime && (
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteTime()}
                                        disabled={isSubmitting}
                                        className="flex-1 font-black py-4 rounded-xl transition-all active:scale-[0.98] shadow-lg bg-red-900/20 text-red-500 border border-red-900/30 hover:bg-red-900/30"
                                    >
                                        削除
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`flex-[2] font-black py-4 rounded-xl transition-all active:scale-[0.98] shadow-lg ${isSubmitting
                                        ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                                        : "bg-white text-black hover:bg-gray-100"
                                        }`}
                                >
                                    {isSubmitting ? "保存中..." : editingTime ? "更新する" : "タイムを保存"}
                                </button>
                            </div>
                        </form>
                    </div>

                    {showDeleteConfirm && (
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                            <div className="w-full max-w-xs bg-[#1a1a1a] border border-gray-800 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                                <h3 className="text-lg font-bold text-center mb-2 text-white">削除の確認</h3>
                                <p className="text-gray-400 text-sm text-center mb-8">
                                    このタイムを削除してもよろしいですか？
                                </p>
                                <div className="flex flex-col space-y-3">
                                    <button
                                        onClick={confirmDelete}
                                        disabled={isSubmitting}
                                        className="w-full bg-red-600 text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-all shadow-lg shadow-red-900/20"
                                    >
                                        {isSubmitting ? "削除中..." : "削除する"}
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        disabled={isSubmitting}
                                        className="w-full bg-[#252525] text-gray-300 font-bold py-3.5 rounded-2xl active:scale-95 transition-all"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
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
                            <div className="flex items-center space-x-3">
                                <h2 className="text-2xl font-bold tracking-tight">自己ベスト</h2>
                                <button
                                    onClick={() => {
                                        setEditingTime(null);
                                        setTimeForm({ stroke: "", distance: "", time: "", poolType: "short" });
                                        setShowTimeInput(true);
                                    }}
                                    className="bg-white text-black text-[11px] font-black px-4 py-2 rounded-full hover:bg-gray-200 transition-all active:scale-95"
                                >
                                    タイム記入
                                </button>
                            </div>
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
                                            <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 mb-1">
                                                <span>{time.date}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-tighter ${time.poolType === 'long' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                                    {time.poolType === 'long' ? '長水路' : '短水路'}
                                                </span>
                                            </div>
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
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-1">メニュー</label>
                                    <div className="flex bg-black/50 p-1 rounded-xl border border-gray-800">
                                        <button
                                            type="button"
                                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${menuInputMode === 'text' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                            onClick={() => {
                                                setMenuInputMode('text');
                                                setMenuPhoto(null);
                                                setPhotoPreview(null);
                                            }}
                                        >
                                            ✍️ 文字で記録
                                        </button>
                                        <button
                                            type="button"
                                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${menuInputMode === 'photo' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                            onClick={() => {
                                                setMenuInputMode('photo');
                                                setDailyForm({ ...dailyForm, menu: "" });
                                            }}
                                        >
                                            📷 写真で記録
                                        </button>
                                    </div>
                                </div>

                                {menuInputMode === 'photo' ? (
                                    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
                                        {!photoPreview ? (
                                            <label className="flex flex-col items-center justify-center w-full h-40 bg-black/50 border-2 border-dashed border-gray-800 rounded-xl cursor-pointer hover:border-gray-600 hover:bg-black/70 transition-all">
                                                <span className="text-3xl mb-2">📸</span>
                                                <span className="text-xs text-gray-400 font-bold">写真を撮る・選ぶ</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files[0]) {
                                                            const file = e.target.files[0];
                                                            setMenuPhoto(file);
                                                            const reader = new FileReader();
                                                            reader.onload = (e) => setPhotoPreview(e.target?.result as string);
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                />
                                            </label>
                                        ) : (
                                            <div className="relative w-full h-40 bg-black/50 rounded-xl overflow-hidden border border-gray-800 group">
                                                <img src={photoPreview} alt="Menu preview" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    className="absolute top-2 right-2 bg-black/60 p-2 rounded-full text-white opacity-100 transition-opacity hover:bg-black/80"
                                                    onClick={() => { setMenuPhoto(null); setPhotoPreview(null); }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="animate-in fade-in zoom-in-95 duration-300">
                                        <textarea
                                            required
                                            placeholder="今日のメニューを具体的に記入してください"
                                            rows={4}
                                            className="w-full bg-black/50 border border-gray-800 rounded-xl px-5 py-3 focus:ring-1 focus:ring-white outline-none transition-all placeholder:text-gray-700 resize-none"
                                            value={dailyForm.menu}
                                            onChange={(e) => setDailyForm({ ...dailyForm, menu: e.target.value })}
                                        />
                                    </div>
                                )}
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
                                        {selectedHistoryItem.photoUrl && (
                                            <div className="mb-3 w-full h-48 bg-black/50 rounded-lg overflow-hidden border border-gray-800">
                                                <img src={selectedHistoryItem.photoUrl} alt="Menu photo" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        {(selectedHistoryItem.menu_fixed || selectedHistoryItem.menu) && (
                                            <div className="text-sm bg-black/30 p-3 rounded-lg border border-gray-800 whitespace-pre-wrap leading-relaxed">
                                                {selectedHistoryItem.menu_fixed || selectedHistoryItem.menu}
                                            </div>
                                        )}
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

                        {/* Icon, Edit Button and UID */}
                        <div className="flex items-center justify-center space-x-8 mb-12">
                            <div className="w-24 h-24 rounded-full bg-gray-900 border-2 border-gray-800 overflow-hidden flex items-center justify-center shadow-2xl shrink-0">
                                {profile.iconUrl ? (
                                    <img src={profile.iconUrl} alt="User Icon" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-4xl text-gray-700">👤</span>
                                )}
                            </div>
                            <div className="flex flex-col items-start space-y-3">
                                <button
                                    onClick={() => {
                                        setShowProfileDisplay(false);
                                        setShowProfileEdit(true);
                                    }}
                                    className="px-6 py-2.5 bg-white text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95 flex items-center space-x-2 shadow-xl"
                                >
                                    <span>✏️</span>
                                    <span>編集する</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (user?.uid) {
                                            navigator.clipboard.writeText(user.uid);
                                            alert("ユーザーIDをコピーしました！");
                                        }
                                    }}
                                    className="group flex flex-col items-start space-y-0.5 hover:opacity-70 transition-all cursor-pointer"
                                    title="タップしてコピー"
                                >
                                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest ml-1">USER ID (Tap to Copy)</span>
                                    <div className="bg-black/20 px-2 py-1 rounded-md border border-gray-800/50 flex items-center space-x-2">
                                        <span className="text-[9px] font-mono text-gray-500 truncate max-w-[120px]">{user?.uid}</span>
                                        <span className="text-[10px] grayscale group-hover:grayscale-0 transition-all">📋</span>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">ニックネーム</p>
                                <p className="text-lg font-medium">{profile.nickname}</p>
                            </div>

                            <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">主な泳法</p>
                                <p className="text-lg font-medium">
                                    {profile.stroke === 'free' ? 'Free' :
                                        profile.stroke === 'back' ? '背泳ぎ' :
                                            profile.stroke === 'breast' ? '平泳ぎ' :
                                                profile.stroke === 'fly' ? 'バタフライ' : '個人メドレー'}
                                </p>
                            </div>

                            <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">自己紹介</p>
                                <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">{profile.bio || "自己紹介はまだありません"}</p>
                            </div>
                        </div>
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

        // Community Screen
        if (showCommunity) {
            const filteredPosts = communityPosts.filter(post => {
                // Visibility check: Show if 'all' OR (if 'followers' and I am following author) OR (I am the author)
                const isAuthor = post.userId === user?.uid;
                const isFollowing = followingList.includes(post.userId);
                const isVisibleBySetting = post.visibility === 'all' || (post.visibility === 'followers' && (isFollowing || isAuthor));

                if (!isVisibleBySetting) return false;

                if (communityTab === "all") return true;
                return isFollowing;
            });

            return (
                <main className="min-h-screen bg-[#121212] text-white p-6 flex flex-col items-center">
                    <div className="w-full max-w-md">
                        <header className="flex flex-col mb-8">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold tracking-tight">コミュニティ</h2>
                                <button
                                    onClick={fetchCommunityPosts}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-xl"
                                    title="更新"
                                >
                                    🔄
                                </button>
                            </div>

                            <div className="flex bg-[#1a1a1a] p-1 rounded-2xl border border-gray-800">
                                <button
                                    onClick={() => setCommunityTab("following")}
                                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${communityTab === "following" ? "bg-white text-black shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
                                >
                                    フォロー中
                                </button>
                                <button
                                    onClick={() => setCommunityTab("all")}
                                    className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${communityTab === "all" ? "bg-white text-black shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
                                >
                                    すべての投稿
                                </button>
                            </div>
                        </header>

                        <div className="space-y-6">
                            {filteredPosts.length > 0 ? (
                                filteredPosts.map((post) => (
                                    <div key={post.id} className="bg-[#1a1a1a] rounded-3xl border border-gray-800 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="p-6">
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-inner overflow-hidden">
                                                        {post.iconUrl ? (
                                                            <img src={post.iconUrl} alt="User Icon" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span>{post.nickname.charAt(0)}</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-bold text-white/90">{post.nickname}</h3>
                                                        <div className="flex items-center space-x-2">
                                                            <p className="text-[10px] text-gray-500 font-medium">{formatDate(post.date)}</p>
                                                            {post.userId === user?.uid && (
                                                                <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-gray-500">
                                                                    {post.visibility === 'all' ? '🌐 公開' : '👥 フォロワー限定'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {post.photoUrl && (
                                                <div className="mb-4 -mx-6">
                                                    <div className="aspect-[4/3] w-full bg-black/50 overflow-hidden">
                                                        <img
                                                            src={post.photoUrl}
                                                            alt="投稿写真"
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-4">
                                                <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                                                    {post.text}
                                                </div>

                                                {/* Post Actions */}
                                                <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
                                                    <div className="flex items-center space-x-6">
                                                        <button
                                                            onClick={() => handleToggleLike(post.id, post.userId)}
                                                            className={`flex items-center space-x-2 group transition-all ${likesData[post.id]?.liked ? "text-pink-500" : "text-gray-500 hover:text-pink-400"}`}
                                                        >
                                                            <span className={`text-xl transition-transform group-active:scale-125 ${likesData[post.id]?.liked ? "animate-in zoom-in" : ""}`}>
                                                                {likesData[post.id]?.liked ? "❤️" : "🤍"}
                                                            </span>
                                                            <span className="text-xs font-bold">{likesData[post.id]?.count || 0}</span>
                                                        </button>

                                                        <button
                                                            onClick={() => setShowCommentsForPost(showCommentsForPost === post.id ? null : post.id)}
                                                            className={`flex items-center space-x-2 group transition-all ${showCommentsForPost === post.id ? "text-blue-400" : "text-gray-500 hover:text-blue-300"}`}
                                                        >
                                                            <span className="text-xl group-active:scale-110 transition-transform">💬</span>
                                                            <span className="text-xs font-bold">{commentsData[post.id]?.length || 0}</span>
                                                        </button>
                                                    </div>

                                                    {post.userId === user?.uid && (
                                                        <button
                                                            onClick={() => handleDeletePost(post.id)}
                                                            className="text-gray-600 hover:text-red-500 transition-all p-1"
                                                            title="削除"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Comments Section */}
                                                {showCommentsForPost === post.id && (
                                                    <div className="mt-6 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                        <div className="max-h-60 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                                                            {commentsData[post.id]?.length > 0 ? (
                                                                commentsData[post.id].map((comment: any) => (
                                                                    <div key={comment.id} className="bg-black/30 p-3 rounded-2xl border border-gray-800/50">
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <span className="text-[10px] font-bold text-gray-400">{comment.nickname}</span>
                                                                            <span className="text-[8px] text-gray-600">{formatDate(comment.timestamp)}</span>
                                                                        </div>
                                                                        <p className="text-xs text-gray-200">{comment.text}</p>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <p className="text-center text-[10px] text-gray-600 py-2 italic">最初のコメントを投稿しましょう</p>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center space-x-2 pt-2">
                                                            <input
                                                                type="text"
                                                                placeholder="コメントを追加..."
                                                                className="flex-1 bg-black/50 border border-gray-800 rounded-full px-4 py-2 text-xs focus:ring-1 focus:ring-white outline-none transition-all"
                                                                value={newComment}
                                                                onChange={(e) => setNewComment(e.target.value)}
                                                                onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id, post.userId)}
                                                            />
                                                            <button
                                                                onClick={() => handleAddComment(post.id, post.userId)}
                                                                disabled={!newComment.trim()}
                                                                className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center text-xs hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-90"
                                                            >
                                                                ➔
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-20 bg-[#1a1a1a] rounded-3xl border border-gray-800 border-dashed">
                                    <div className="text-4xl mb-4">🌊</div>
                                    <p className="text-gray-500 text-sm">
                                        {communityTab === "following" ? "フォローしているユーザーの投稿がありません" : "投稿がまだありません"}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="h-20" /> {/* Spacer */}
                    </div>

                    {/* Floating + Button */}
                    {!showCommunityPostInput && (
                        <button
                            onClick={() => setShowCommunityPostInput(true)}
                            className="fixed bottom-10 right-10 w-16 h-16 bg-white text-black rounded-full flex items-center justify-center text-3xl shadow-2xl hover:scale-110 active:scale-95 transition-all z-50 animate-bounce"
                        >
                            ＋
                        </button>
                    )}

                    {/* Community Post Input Modal */}
                    {showCommunityPostInput && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                            <div className="w-full max-w-md bg-[#1a1a1a] border border-gray-800 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300 relative">
                                <button
                                    onClick={() => {
                                        setShowCommunityPostInput(false);
                                        setCommunityPhoto(null);
                                        setCommunityPhotoPreview(null);
                                    }}
                                    className="absolute top-4 right-4 text-gray-500 hover:text-white p-2"
                                >
                                    ✕
                                </button>
                                <h2 className="text-xl font-bold mb-6 text-center">コミュニティに投稿</h2>

                                <form onSubmit={handleCommunityPostSubmit} className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">投稿内容</label>
                                        <textarea
                                            className="w-full bg-black/50 border border-gray-800 rounded-2xl px-5 py-4 focus:ring-1 focus:ring-white outline-none transition-all placeholder:text-gray-700 min-h-[120px] text-sm leading-relaxed"
                                            placeholder="練習の振り返りやメッセージを入力..."
                                            value={communityPostForm.text}
                                            onChange={(e) => setCommunityPostForm({ ...communityPostForm, text: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">写真</label>
                                        <div className="flex flex-col items-center">
                                            {communityPhotoPreview ? (
                                                <div className="relative w-full aspect-[16/9] bg-black rounded-2xl overflow-hidden mb-3 group">
                                                    <img src={communityPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCommunityPhoto(null);
                                                            setCommunityPhotoPreview(null);
                                                        }}
                                                        className="absolute top-2 right-2 bg-black/50 p-2 rounded-full hover:bg-black/80 text-white transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="w-full h-32 border-2 border-dashed border-gray-800 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-gray-600 transition-all">
                                                    <span className="text-2xl mb-1">📷</span>
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">写真を選択</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={handleCommunityPhotoChange}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">公開範囲</label>
                                        <div className="flex bg-black/50 p-1 rounded-xl border border-gray-800">
                                            <button
                                                type="button"
                                                onClick={() => setCommunityPostForm({ ...communityPostForm, visibility: "all" })}
                                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${communityPostForm.visibility === "all" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
                                            >
                                                🌐 全ユーザー
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCommunityPostForm({ ...communityPostForm, visibility: "followers" })}
                                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${communityPostForm.visibility === "followers" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
                                            >
                                                👥 フォロワーのみ
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`w-full py-4 rounded-2xl font-black transition-all active:scale-95 shadow-xl ${isSubmitting
                                            ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                                            : "bg-white text-black hover:bg-gray-100"
                                            }`}
                                    >
                                        {isSubmitting ? "投稿中..." : "投稿する"}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </main>
            );
        }

        // Friends Screen
        if (showFriends) {
            return (
                <main className="min-h-screen bg-[#121212] text-white p-6 flex flex-col items-center">
                    <div className="w-full max-w-md">
                        <header className="mb-8">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold tracking-tight">友達</h2>
                                <button
                                    onClick={() => setShowUserSearch(true)}
                                    className="p-2 bg-white/5 border border-gray-800 rounded-full hover:bg-white/10 transition-all"
                                    title="ユーザー検索"
                                >
                                    🔍
                                </button>
                            </div>
                        </header>

                        {/* Search Overlay/Section */}
                        {showUserSearch && (
                            <section className="mb-10 animate-in fade-in slide-in-from-top-4 duration-300">
                                <form onSubmit={handleSearchUsers} className="flex space-x-2 mb-6">
                                    <input
                                        type="text"
                                        placeholder="名前またはIDで検索"
                                        className="flex-1 bg-black/50 border border-gray-800 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-white outline-none"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <button type="submit" className="bg-white text-black px-4 py-2.5 rounded-xl font-bold text-sm">検索</button>
                                </form>

                                <div className="space-y-3">
                                    {searchResults.map(u => (
                                        <div key={u.id} onClick={() => setViewingUser(u)} className="bg-black/30 p-4 rounded-xl border border-gray-800 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-all">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden flex items-center justify-center">
                                                    {u.iconUrl ? <img src={u.iconUrl} className="w-full h-full object-cover" /> : <span>👤</span>}
                                                </div>
                                                <span className="font-bold text-sm">{u.nickname}</span>
                                            </div>
                                            <span className="text-gray-600">→</span>
                                        </div>
                                    ))}
                                    {searchQuery && searchResults.length === 0 && (
                                        <p className="text-center text-xs text-gray-500 py-4">ユーザーが見つかりませんでした</p>
                                    )}
                                </div>
                                <button onClick={() => { setShowUserSearch(false); setSearchResults([]); setSearchQuery(""); }} className="w-full mt-4 py-2 text-xs text-gray-500 hover:text-gray-300">検索を閉じる</button>
                            </section>
                        )}

                        {/* Follow Requests Modal */}
                        {showRequestList && (
                            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
                                <div className="w-full max-w-md bg-[#1a1a1a] border border-gray-800 rounded-3xl p-8 shadow-2xl relative max-h-[80vh] flex flex-col">
                                    <button onClick={() => setShowRequestList(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white p-2">✕</button>
                                    <h3 className="text-xl font-bold mb-6">フォローリクエスト</h3>

                                    <div className="flex-1 overflow-y-auto space-y-4">
                                        {followRequests.length > 0 ? (
                                            followRequests.map(u => (
                                                <div key={u.id} className="bg-white/5 p-4 rounded-2xl border border-gray-800 flex justify-between items-center">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden">
                                                            {u.iconUrl ? <img src={u.iconUrl} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full">👤</div>}
                                                        </div>
                                                        <span className="font-bold text-sm">{u.nickname}</span>
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => handleAcceptRequest(u.id)}
                                                            className="bg-white text-black px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                                                        >
                                                            承認
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (!user) return;
                                                                await deleteDoc(doc(db, "users", user.uid, "follow_requests", u.id));
                                                                fetchFollowRequests();
                                                            }}
                                                            className="bg-white/5 text-gray-500 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white/10 transition-colors"
                                                        >
                                                            拒否
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                                                <span className="text-4xl mb-4">📭</span>
                                                <p className="text-sm">リクエストはありません</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Mutual Friends (Following) */}
                        <section className="mb-10">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 ml-1">フォロー中</h3>
                            <div className="space-y-3">
                                {allUsers.filter(u => followingList.includes(u.id)).map((u) => (
                                    <div key={u.id} onClick={() => setViewingUser(u)} className="bg-[#1a1a1a] p-4 rounded-2xl border border-gray-800 flex justify-between items-center transition-all hover:border-gray-700 cursor-pointer">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center shadow-lg overflow-hidden">
                                                {u.iconUrl ? <img src={u.iconUrl} className="w-full h-full object-cover" /> : <span>👤</span>}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm text-white/90">{u.nickname || "匿名ユーザー"}</h3>
                                            </div>
                                        </div>
                                        <span className="text-gray-700">→</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Recommendations */}
                        <section className="mb-10">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 ml-1">おすすめのユーザー</h3>
                            <div className="space-y-3">
                                {recommendedUsers.map((u) => (
                                    <div key={u.id} onClick={() => setViewingUser(u)} className="bg-[#1a1a1a] p-4 rounded-2xl border border-gray-800 flex justify-between items-center hover:border-gray-700 cursor-pointer transition-all">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden">
                                                {u.iconUrl ? <img src={u.iconUrl} className="w-full h-full object-cover" /> : <span>👤</span>}
                                            </div>
                                            <span className="font-bold text-sm">{u.nickname}</span>
                                        </div>
                                        <span className="text-gray-700">→</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Floating Bell Icon (Notifications) */}
                    <div className="fixed bottom-10 right-10 z-50">
                        <button
                            onClick={() => setShowRequestList(true)}
                            className="w-14 h-14 bg-white text-black rounded-full shadow-2xl flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition-all relative"
                        >
                            🔔
                            {followRequests.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-[#121212]">
                                    {followRequests.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Other User Profile Modal */}
                    {viewingUser && (
                        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                            <div className="w-full max-w-md bg-[#1a1a1a] border border-gray-800 rounded-3xl p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
                                <button onClick={() => setViewingUser(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white p-2">✕</button>

                                <div className="flex flex-col items-center mb-8">
                                    <div className="w-24 h-24 rounded-full bg-gray-800 border-2 border-gray-700 overflow-hidden flex items-center justify-center mb-4">
                                        {viewingUser.iconUrl ? <img src={viewingUser.iconUrl} className="w-full h-full object-cover" /> : <span className="text-4xl">👤</span>}
                                    </div>
                                    <h2 className="text-xl font-bold">{viewingUser.nickname}</h2>
                                    <p className="text-[10px] text-gray-500 font-mono mt-1">ID: {viewingUser.id}</p>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">主な泳法</p>
                                        <p className="text-sm font-bold">{viewingUser.stroke || "未設定"}</p>
                                    </div>
                                    <div className="bg-black/30 p-4 rounded-xl border border-gray-800">
                                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">自己紹介</p>
                                        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{viewingUser.bio || "自己紹介はありません"}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        if (followingList.includes(viewingUser.id)) {
                                            handleFollow(viewingUser.id); // Unfollow
                                        } else {
                                            handleSendFollowRequest(viewingUser.id);
                                        }
                                    }}
                                    className={`w-full py-3.5 rounded-2xl font-black text-xs transition-all active:scale-95 ${followingList.includes(viewingUser.id)
                                        ? "bg-gray-800 text-gray-400"
                                        : sentRequestUids.includes(viewingUser.id)
                                            ? "bg-gray-700 text-gray-400"
                                            : "bg-white text-black shadow-lg"
                                        }`}
                                >
                                    {followingList.includes(viewingUser.id)
                                        ? "フォロー解除"
                                        : sentRequestUids.includes(viewingUser.id)
                                            ? "送信済み (タップで取消)"
                                            : "フォローリクエストを送信"}
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            );
        }

        // Login Info Edit


        // Profile Setup / Edit Form
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
                            {needsSetup ? "初期設定" : "プロフィール編集"}
                        </h2>
                        <form onSubmit={handleProfileSubmit} className="space-y-4">
                            {/* Icon Upload */}
                            <div className="flex flex-col items-center mb-6">
                                <label className="relative cursor-pointer group">
                                    <div className="w-24 h-24 rounded-full bg-gray-900 border-2 border-gray-800 overflow-hidden flex items-center justify-center transition-all group-hover:border-white/50 shadow-2xl">
                                        {profilePhotoPreview || formData.iconUrl ? (
                                            <img src={profilePhotoPreview || formData.iconUrl} alt="Icon Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-4xl text-gray-700 group-hover:scale-110 transition-transform">👤</span>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-white text-[10px] font-black uppercase tracking-widest">変更</span>
                                        </div>
                                    </div>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoChange} />
                                </label>
                                <p className="text-[10px] text-gray-500 mt-3 font-black uppercase tracking-[0.2em] ml-1">プロフィール写真</p>
                            </div>

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

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">主な泳法</label>
                                <select
                                    required
                                    className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all"
                                    value={formData.stroke}
                                    onChange={(e) => setFormData({ ...formData, stroke: e.target.value })}
                                >
                                    <option value="">選択してください</option>
                                    <option value="free">Free</option>
                                    <option value="back">背泳ぎ</option>
                                    <option value="breast">平泳ぎ</option>
                                    <option value="fly">バタフライ</option>
                                    <option value="im">個人メドレー</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">自己紹介</label>
                                <textarea
                                    className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all min-h-[100px] resize-none"
                                    value={formData.bio}
                                    placeholder="自己紹介文を入力してください"
                                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                />
                            </div>

                            {needsSetup && (
                                <div className="pt-6 border-t border-gray-800 mt-6 space-y-4">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center mb-4">以下の情報は後で設定から変更できます</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">年齢</label>
                                            <input
                                                required
                                                type="number"
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
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`w-full font-bold py-3 rounded-lg mt-4 transition-all active:scale-95 ${isSubmitting
                                    ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                                    : "bg-white text-black hover:bg-gray-200"
                                    }`}
                            >
                                {isSubmitting ? "保存中..." : needsSetup ? "設定を完了する" : "保存する"}
                            </button>
                        </form>
                    </div>
                </main>
            );
        }

        // Account Edit Form (Age, Gender, Stroke, etc.)
        if (showAccountEdit && user) {
            return (
                <main className="min-h-screen bg-[#121212] text-white p-6 flex items-center justify-center">
                    <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl border border-gray-800 shadow-2xl relative">
                        <button
                            onClick={() => setShowAccountEdit(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                        >
                            ✕
                        </button>
                        <h2 className="text-2xl font-bold mb-6 text-center tracking-tight">アカウント詳細設定</h2>
                        <form onSubmit={handleProfileSubmit} className="space-y-4">
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
                                    <option value="free">Free</option>
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
                                {isSubmitting ? "保存中..." : "保存する"}
                            </button>
                        </form>
                    </div>
                </main>
            );
        }
        if (showLoginDisplay) {
            const providers = user?.providerData.map(p => p.providerId) || [];
            const isEmailUser = providers.includes("password");
            const isGoogleUser = providers.includes("google.com");

            return (
                <main className="min-h-screen bg-[#121212] text-white p-6 flex flex-col items-center">
                    <div className="w-full max-w-md">
                        <header className="flex items-center mb-8">
                            <button
                                onClick={() => setShowLoginDisplay(false)}
                                className="mr-3 p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                ←
                            </button>
                            <h2 className="text-xl font-bold">ログイン情報</h2>
                        </header>

                        <div className="space-y-6">
                            <section>
                                <h3 className="text-[10px] font-black text-gray-500 mb-3 uppercase tracking-[0.2em] ml-1">基本情報</h3>
                                <div className="bg-[#1a1a1a] rounded-2xl border border-gray-800 overflow-hidden">
                                    {/* 電話番号 */}
                                    <div className="flex justify-between items-center px-5 py-4 border-b border-gray-800/50">
                                        <span className="text-sm font-bold text-gray-400">電話番号</span>
                                        <span className="text-sm text-gray-200">{user?.phoneNumber || "未登録"}</span>
                                    </div>

                                    {/* メールアドレス */}
                                    <div className="flex justify-between items-center px-5 py-4 border-b border-gray-800/50">
                                        <span className="text-sm font-bold text-gray-400">メールアドレス</span>
                                        <span className="text-sm text-gray-200 truncate max-w-[180px]">{user?.email || "未登録"}</span>
                                    </div>

                                    {/* パスワード */}
                                    <button
                                        onClick={() => isEmailUser && setShowLoginEdit(true)}
                                        className="w-full flex justify-between items-center px-5 py-4 border-b border-gray-800/50 hover:bg-white/5 transition-colors group"
                                    >
                                        <span className="text-sm font-bold text-gray-400">パスワード</span>
                                        <span className="text-sm text-gray-200 flex items-center">
                                            登録完了 <span className="ml-2 text-gray-600 group-hover:translate-x-1 transition-transform">＞</span>
                                        </span>
                                    </button>

                                    <div className="flex justify-between items-center px-5 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-400">Google連携</span>
                                            <div className="flex space-x-2 mt-2">
                                                {isGoogleUser && <span className="text-[10px] bg-blue-500/20 px-2 py-0.5 rounded text-blue-400">🌐 Google連携中</span>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                alert("この機能は現在準備中です。");
                                            }}
                                            className="bg-white text-black text-[10px] font-black px-4 py-2 rounded-full hover:bg-gray-200 transition-all active:scale-95"
                                        >
                                            連携する
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <button
                                onClick={() => setShowAccountDeleteConfirm(true)}
                                className="w-full bg-red-900/10 border border-red-900/20 text-red-500 font-bold py-4 rounded-xl hover:bg-red-900/20 transition-all text-sm"
                            >
                                アカウントの削除
                            </button>
                        </div>
                    </div>

                    {showAccountDeleteConfirm && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
                            <div className="w-full max-w-xs bg-[#1a1a1a] border border-red-900/30 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <span className="text-3xl">⚠️</span>
                                </div>
                                <h3 className="text-lg font-bold text-center mb-2 text-white">アカウント削除の確認</h3>
                                <p className="text-gray-400 text-sm text-center mb-8 leading-relaxed">
                                    アカウントを削除すると、すべての記録が完全に消去され、復元することはできません。本当に削除しますか？
                                </p>
                                <div className="flex flex-col space-y-3">
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={isSubmitting}
                                        className="w-full bg-red-600 text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-all shadow-lg"
                                    >
                                        {isSubmitting ? "削除中..." : "完全に削除する"}
                                    </button>
                                    <button
                                        onClick={() => setShowAccountDeleteConfirm(false)}
                                        disabled={isSubmitting}
                                        className="w-full bg-[#252525] text-gray-300 font-bold py-3.5 rounded-2xl active:scale-95 transition-all"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            );
        }

        if (showLoginEdit) {
            return (
                <main className="min-h-screen bg-[#121212] text-white p-6 flex flex-col items-center">
                    <div className="w-full max-w-md">
                        <header className="flex items-center mb-8">
                            <button
                                onClick={() => setShowLoginEdit(false)}
                                className="mr-3 p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                ←
                            </button>
                            <h2 className="text-xl font-bold">メール・パスワード変更</h2>
                        </header>

                        <form onSubmit={handleUpdateLoginInfo} className="space-y-6">
                            <div className="bg-[#1a1a1a] rounded-2xl border border-gray-800 p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">現在のパスワード（必須）</label>
                                    <input
                                        required
                                        type="password"
                                        className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all"
                                        value={emailForm.currentPassword}
                                        onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
                                    />
                                </div>
                                <div className="pt-4 border-t border-gray-800">
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">新しいメールアドレス</label>
                                    <input
                                        type="email"
                                        placeholder={user?.email || ""}
                                        className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all"
                                        value={emailForm.newEmail}
                                        onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">新しいパスワード</label>
                                    <input
                                        type="password"
                                        className="w-full bg-black border border-gray-800 rounded-lg px-4 py-2 focus:ring-1 focus:ring-white outline-none transition-all"
                                        value={emailForm.newPassword}
                                        onChange={(e) => setEmailForm({ ...emailForm, newPassword: e.target.value })}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 ${isSubmitting
                                    ? "bg-gray-700 text-gray-400"
                                    : "bg-white text-black hover:bg-gray-100"
                                    }`}
                            >
                                {isSubmitting ? "更新中..." : "変更を保存する"}
                            </button>
                        </form>
                    </div>
                </main>
            );
        }
        return (
            <main className="min-h-screen bg-[#121212] text-white p-6">
                <div className="max-w-md mx-auto">
                    <header className="flex justify-end items-center mb-10">
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
                                <SettingsItem label="アカウント設定" onClick={() => setShowAccountEdit(true)} />
                                <SettingsItem label="ログイン情報" onClick={() => setShowLoginDisplay(true)} />
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
                        <div className="flex flex-col space-y-8 animate-in fade-in duration-700">
                            {/* お知らせ */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold">お知らせ</h2>
                                    {announcements.length > 0 && (
                                        <button onClick={handleOpenNewsList} className="text-xs text-blue-400 hover:text-blue-300">
                                            すべて見る
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {(() => {
                                        const oneWeekAgo = new Date();
                                        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

                                        const recentAnnouncements = announcements.filter(news => {
                                            let newsDate;
                                            if (news.date && (news.date as any).toDate) {
                                                newsDate = (news.date as any).toDate();
                                            } else {
                                                newsDate = new Date(news.date);
                                            }
                                            return newsDate >= oneWeekAgo;
                                        });

                                        return recentAnnouncements.length > 0 ? (
                                            recentAnnouncements.map((news) => (
                                                <div key={news.id} className="bg-[#1a1a1a] p-4 rounded-xl border border-gray-800 border-l-2 border-l-blue-500">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] text-blue-400 font-bold">{news.type}</span>
                                                        <span className="text-[10px] text-gray-500">{formatDate(news.date)}</span>
                                                    </div>
                                                    <h3 className="text-sm font-bold text-white/90">{news.title}</h3>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-6 text-sm text-gray-500 bg-[#1a1a1a] rounded-xl border border-gray-800 border-dashed">
                                                過去1週間のお知らせはありません
                                            </div>
                                        );
                                    })()}
                                </div>
                            </section>

                            {/* 日々の記録一覧 */}
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold">最近の記録</h2>
                                    <button onClick={fetchDailyHistory} className="text-xs text-blue-400 hover:text-blue-300">
                                        すべて見る
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {(() => {
                                        const oneWeekAgo = new Date();
                                        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

                                        const recentWeekRecords = historyRecords.filter(record => {
                                            const recordDate = new Date(record.date);
                                            return recordDate >= oneWeekAgo;
                                        });

                                        return recentWeekRecords.length > 0 ? (
                                            recentWeekRecords.map((record, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => {
                                                        setSelectedHistoryItem(record);
                                                        setShowDailyHistory(true);
                                                    }}
                                                    className="w-full text-left bg-[#1a1a1a] p-4 rounded-xl border border-gray-800 flex flex-col hover:border-white/30 transition-colors active:scale-[0.98] cursor-pointer group"
                                                >
                                                    <div className="flex justify-between w-full items-start mb-2">
                                                        <div className="text-xs font-bold text-gray-500 group-hover:text-gray-300 transition-colors">{record.date}</div>
                                                        <div className="text-yellow-400 text-xs">
                                                            {"★".repeat(record.rating || 0)}{"☆".repeat(5 - (record.rating || 0))}
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed group-hover:text-white transition-colors">
                                                        {record.menu_fixed || record.menu}
                                                    </p>
                                                    {record.tags && record.tags.length > 0 && (
                                                        <div className="flex gap-1 flex-wrap mt-2">
                                                            {record.tags.map(tag => (
                                                                <span key={tag} className="text-[9px] px-2 py-0.5 rounded-md bg-gray-800/50 border border-gray-700/50 text-gray-400 group-hover:bg-gray-700/50 transition-colors">
                                                                    #{tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="text-center py-6 text-sm text-gray-500 bg-[#1a1a1a] rounded-xl border border-gray-800 border-dashed">
                                                過去1週間の記録はありません
                                            </div>
                                        );
                                    })()}
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                        <div className="w-full max-w-xs bg-[#1a1a1a] border border-gray-800 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                            <h3 className="text-lg font-bold text-center mb-2 text-white">削除の確認</h3>
                            <p className="text-gray-400 text-sm text-center mb-8">
                                このタイムを削除してもよろしいですか？
                            </p>
                            <div className="flex flex-col space-y-3">
                                <button
                                    onClick={confirmDelete}
                                    disabled={isSubmitting}
                                    className="w-full bg-red-600 text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-all shadow-lg shadow-red-900/20"
                                >
                                    {isSubmitting ? "削除中..." : "削除する"}
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={isSubmitting}
                                    className="w-full bg-[#252525] text-gray-300 font-bold py-3.5 rounded-2xl active:scale-95 transition-all"
                                >
                                    キャンセル
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        );
    };

    return (
        <div className="flex h-screen bg-[#121212] overflow-hidden">
            {/* Sidebar */}
            <aside className={`bg-[#1a1a1a] border-r border-gray-800 flex flex-col flex-shrink-0 z-10 transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
                <div className={`h-full flex flex-col ${isSidebarCollapsed ? 'items-center px-2 py-6' : 'p-6'}`}>
                    <div className={`flex items-center mb-10 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                        {!isSidebarCollapsed && (
                            <h1
                                className="text-2xl font-bold tracking-tighter italic text-white cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={resetToHome}
                            >
                                swim note
                            </h1>
                        )}
                        <button
                            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                        >
                            <Menu size={24} />
                        </button>
                    </div>

                    {profile && (
                        <div className={`flex items-center mb-10 px-2 cursor-pointer hover:opacity-80 transition-opacity ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'}`} onClick={() => { resetToHome(); setShowProfileDisplay(true); }}>
                            <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center shadow-inner shrink-0">
                                {profile.iconUrl ? (
                                    <img src={profile.iconUrl} alt="Icon" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xl">👤</span>
                                )}
                            </div>
                            {!isSidebarCollapsed && (
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-white/90 truncate max-w-[100px]">{profile.nickname}</span>
                                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">
                                        {profile.stroke === 'free' ? 'Free' :
                                            profile.stroke === 'back' ? '背泳ぎ' :
                                                profile.stroke === 'breast' ? '平泳ぎ' :
                                                    profile.stroke === 'fly' ? 'バタフライ' :
                                                        profile.stroke === 'im' ? '個人メドレー' : 'スイマー'}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <nav className="flex-1 space-y-2">
                        <SidebarItem icon="📝" title="今日の記録" onClick={() => { resetToHome(); setShowDailyInput(true); }} active={showDailyInput} isCollapsed={isSidebarCollapsed} />
                        <SidebarItem icon="📚" title="日々の記録" onClick={() => { resetToHome(); fetchDailyHistory(); }} active={showDailyHistory} isCollapsed={isSidebarCollapsed} />
                        <SidebarItem icon="⏱️" title="自己ベスト" onClick={() => { resetToHome(); fetchTimeHistory(); }} active={showTimeHistory} isCollapsed={isSidebarCollapsed} />
                        <SidebarItem icon="🧘" title="ストレッチ" locked onClick={() => { }} isCollapsed={isSidebarCollapsed} />
                        <SidebarItem icon="🏊" title="泳法研究" locked onClick={() => { }} isCollapsed={isSidebarCollapsed} />
                        <SidebarItem icon="👥" title="コミュニティ" onClick={() => { resetToHome(); setShowCommunity(true); }} active={showCommunity} isCollapsed={isSidebarCollapsed} />
                        <SidebarItem icon="🤝" title="友達" onClick={() => { resetToHome(); setShowFriends(true); }} active={showFriends} isCollapsed={isSidebarCollapsed} />
                        <SidebarItem icon="⚙️" title="設定" onClick={() => { resetToHome(); setShowSettings(true); }} active={showSettings} isCollapsed={isSidebarCollapsed} />
                    </nav>
                </div>
            </aside>
            <div className="flex-1 overflow-y-auto w-full relative">
                {renderContent()}
            </div>
        </div>
    );
}

function SidebarItem({ icon, title, onClick, locked = false, active = false, isCollapsed = false }: { icon: string; title: string; onClick: () => void; locked?: boolean; active?: boolean; isCollapsed?: boolean }) {
    return (
        <button
            onClick={locked ? undefined : onClick}
            disabled={locked}
            className={`w-full flex items-center p-3 rounded-xl transition-all ${isCollapsed ? 'justify-center' : ''} ${locked ? "opacity-50 cursor-not-allowed text-gray-500" :
                active ? "bg-white/10 text-white font-bold" :
                    "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
            title={isCollapsed ? title : undefined}
        >
            <span className={`text-xl ${isCollapsed ? '' : 'mr-3'}`}>{locked ? "🔒" : icon}</span>
            {!isCollapsed && <span className="text-sm font-bold tracking-wider">{title}</span>}
        </button>
    );
}

function ListItem({ icon, title, onClick, locked = false }: { icon: string; title: string; onClick: () => void; locked?: boolean }) {
    return (
        <button
            onClick={locked ? undefined : onClick}
            disabled={locked}
            className={`w-full flex items-center justify-between p-5 bg-[#1a1a1a] rounded-2xl border border-gray-800 transition-all ${locked ? "opacity-60 cursor-not-allowed" : "hover:border-white/30 active:scale-[0.98] group shadow-lg"}`}
        >
            <div className="flex items-center space-x-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${locked ? "bg-gray-800 text-gray-500" : "bg-white/5 text-white group-hover:scale-110 transition-transform"}`}>
                    {locked ? "🔒" : icon}
                </div>
                <span className={`font-bold tracking-wider text-base ${locked ? "text-gray-500" : "text-gray-200 group-hover:text-white"}`}>
                    {title}
                </span>
            </div>
            {!locked && (
                <span className="text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all">
                    →
                </span>
            )}
        </button>
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