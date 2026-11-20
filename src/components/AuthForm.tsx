"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel mx-auto mt-10 flex w-full max-w-sm flex-col gap-3 rounded-xl p-5">
      <h1 className="text-xl font-bold">{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h1>
      {mode === "register" && (
        <label className="flex flex-col gap-1 text-sm">
          Tên hiển thị
          <input name="name" className="input" required maxLength={60} autoComplete="name" />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input name="email" type="email" className="input" required autoComplete="email" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Mật khẩu
        <input
          name="password"
          type="password"
          className="input"
          required
          minLength={mode === "register" ? 8 : 1}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Đăng ký"}
      </button>
      <p className="muted text-sm">
        {mode === "login" ? (
          <>
            Chưa có tài khoản? <Link className="underline" href="/register">Đăng ký</Link>
          </>
        ) : (
          <>
            Đã có tài khoản? <Link className="underline" href="/login">Đăng nhập</Link>
          </>
        )}
      </p>
    </form>
  );
}
