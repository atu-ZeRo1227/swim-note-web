"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, OAuthProvider } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const handleAuth = async () => {
        setError("");
        setMessage("");
        try {
            if (isLogin) {
                // Login logic
                const userCredential = await signInWithEmailAndPassword(auth, email, password);

                // 最終ログイン日時を更新 (失敗してもログインは継続)
                try {
                    await setDoc(doc(db, "users", userCredential.user.uid), {
                        lastLogin: serverTimestamp(),
                    }, { merge: true });
                } catch (fsError) {
                    console.error("Firestore Error (Login):", fsError);
                    // ユーザーに警告は出すが、ログインは進める
                }

                router.push("/");
            } else {
                // Sign up logic
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);

                // アカウント情報をFirestoreに保存 (失敗しても登録自体は進める)
                try {
                    await setDoc(doc(db, "users", userCredential.user.uid), {
                        email: userCredential.user.email,
                        createdAt: serverTimestamp(),
                        lastLogin: serverTimestamp(),
                    }, { merge: true });
                } catch (fsError) {
                    console.error("Firestore Error (Signup):", fsError);
                }

                // Send verification email
                await sendEmailVerification(userCredential.user);

                setMessage("登録完了メールを送信しました！メール内のリンクをクリックして認証し、再度ログインしてください。メールが来ない場合は迷惑メールを確認してみてください。");
                setPassword(""); // Clear password for security
            }
        } catch (e: any) {
            console.error(e);
            if (e.code === "auth/email-already-in-use") {
                setError("このメールアドレスは既に登録されています。");
            } else if (e.code === "auth/weak-password") {
                setError("パスワードは6文字以上で入力してください。");
            } else if (e.code === "auth/invalid-email") {
                setError("不正なメールアドレス形式です。");
            } else if (e.code === "auth/user-not-found") {
                setError("登録されていないメールアドレスです。");
            } else if (e.code === "auth/wrong-password") {
                setError("パスワードが間違っています。");
            } else if (e.code === "auth/invalid-credential") {
                // For newer Firebase versions, invalid-credential covers both cases for security.
                // We show a more general but helpful message.
                setError("メールアドレスまたはパスワードが間違っています。");
            } else {
                setError(isLogin ? "ログインに失敗しました。" : "登録に失敗しました。");
            }
        }
    };

    const handlePasswordReset = async () => {
        if (!email) {
            setError("パスワードを再設定するにはメールアドレスを入力してください。");
            return;
        }
        setError("");
        setMessage("");
        try {
            await sendPasswordResetEmail(auth, email);
            setMessage("パスワード再設定メールを送信しました！メールを確認してください。");
        } catch (e: any) {
            console.error(e);
            if (e.code === "auth/user-not-found") {
                setError("登録されていないメールアドレスです。");
            } else if (e.code === "auth/invalid-email") {
                setError("不正なメールアドレス形式です。");
            } else {
                setError("メール送信に失敗しました。しばらく時間をおいてから再度お試しください。");
            }
        }
    };

    const handleGoogleAuth = async () => {
        setError("");
        setMessage("");
        const provider = new GoogleAuthProvider();
        try {
            const userCredential = await signInWithPopup(auth, provider);

            // アカウント情報をFirestoreに保存/更新
            try {
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    email: userCredential.user.email,
                    lastLogin: serverTimestamp(),
                }, { merge: true });
            } catch (fsError) {
                console.error("Firestore Error (Google Auth):", fsError);
            }

            router.push("/");
        } catch (e: any) {
            console.error(e);
            if (e.code !== "auth/popup-closed-by-user") {
                setError("Google認証に失敗しました。");
            }
        }
    };

    const handleAppleAuth = async () => {
        setError("");
        setMessage("");
        const provider = new OAuthProvider('apple.com');
        try {
            const userCredential = await signInWithPopup(auth, provider);

            // アカウント情報をFirestoreに保存/更新
            try {
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    email: userCredential.user.email,
                    lastLogin: serverTimestamp(),
                }, { merge: true });
            } catch (fsError) {
                console.error("Firestore Error (Apple Auth):", fsError);
            }

            router.push("/");
        } catch (e: any) {
            console.error(e);
            if (e.code !== "auth/popup-closed-by-user") {
                setError("Apple認証に失敗しました。");
            }
        }
    };

    const handleResendVerification = async () => {
        setError("");
        setMessage("");
        try {
            const user = auth.currentUser;
            if (user) {
                await sendEmailVerification(user);
                setMessage("認証メールを再送信しました。メールフォルダを確認してください。");
            } else {
                setError("セッションが切れました。一度ログインし直してから確認してください。");
            }
        } catch (e: any) {
            console.error(e);
            setError("メールの再送信に失敗しました。しばらく時間をおいてから再度お試しください。");
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#121212] transition-colors duration-500">
            <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700">
                <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white transition-all">
                    {isLogin ? "ログイン" : "新規登録"}
                </h1>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">メールアドレス</label>
                        <input
                            type="email"
                            placeholder="example@mail.com"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all dark:bg-gray-700 dark:text-white"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1 ml-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">パスワード</label>
                            {isLogin && (
                                <button
                                    onClick={handlePasswordReset}
                                    className="text-xs text-gray-500 hover:text-black transition-colors underline"
                                >
                                    パスワードをお忘れですか？
                                </button>
                            )}
                        </div>
                        <input
                            type="password"
                            placeholder="••••••••"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all dark:bg-gray-700 dark:text-white"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleAuth}
                        className="w-full py-3 px-4 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out transform active:scale-[0.98]"
                    >
                        {isLogin ? "ログイン" : "登録する"}
                    </button>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                        <span className="flex-shrink mx-4 text-gray-400 text-sm">または</span>
                        <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                    </div>

                    <button
                        onClick={handleGoogleAuth}
                        className="w-full py-3 px-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 transition-all duration-200 flex items-center justify-center space-x-3 shadow-sm active:scale-[0.98]"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                            />
                        </svg>
                        <span>Googleで{isLogin ? "ログイン" : "新規登録"}</span>
                    </button>

                    <button
                        onClick={handleAppleAuth}
                        className="w-full py-3 px-4 bg-[#000000] hover:bg-[#1a1a1a] text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center space-x-3 shadow-md active:scale-[0.98]"
                    >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                            <path d="M17.057 10.78c.038 1.956 1.705 2.613 1.734 2.628-.014.053-.266.924-.87 1.815-.526.772-1.077 1.543-1.933 1.558-.84.015-1.112-.51-2.07-.51-.958 0-1.258.495-2.054.525-.826.03-1.44-.825-1.973-1.589-1.096-1.575-1.935-4.44-1.012-6.046.458-.802 1.28-1.312 2.175-1.327.683-.015 1.334.465 1.755.465.42 0 1.208-.585 2.033-.502.345.015 1.312.135 1.935.953-.053.03-1.155.675-1.14 2.04M14.65 6.007c.36-.45.607-1.072.54-1.695-.532.022-1.177.36-1.552.81-.337.398-.637 1.035-.562 1.642.592.053 1.208-.307 1.574-.757z" />
                        </svg>
                        <span>Appleで{isLogin ? "ログイン" : "新規登録"}</span>
                    </button>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                        <span className="flex-shrink mx-4 text-gray-400 text-sm">以前の方法で</span>
                        <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                    </div>

                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError("");
                            setMessage("");
                        }}
                        className="w-full py-2 px-4 transition-all duration-200 text-black hover:text-gray-600 font-semibold text-sm underline-offset-4 hover:underline"
                    >
                        {isLogin ? "新規登録はこちら" : "ログインに戻る"}
                    </button>
                </div>

                {message && (
                    <div className="space-y-4">
                        <div className="p-4 text-sm text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-center font-medium">
                            {message}
                        </div>
                        {(message.includes("登録完了メール") || message.includes("認証メールを再送信しました")) && (
                            <button
                                onClick={handleResendVerification}
                                className="w-full py-2 px-4 text-sm text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors underline decoration-dotted underline-offset-4"
                            >
                                認証メールを再送信する
                            </button>
                        )}
                    </div>
                )}

                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-center font-medium">
                        {error}
                    </div>
                )}
            </div>
        </main>
    );
}