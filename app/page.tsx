"use client";
import { useState } from "react";

export default function Home() {
  const [code, setCode] = useState("");
  const [review, setReview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReview() {
    setLoading(true);
    setError("");
    setReview("");
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Review failed");
      setReview(data.review);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">React Code Reviewer</h1>

      <label htmlFor="code" className="mt-6 block font-medium">
        Paste your React code
      </label>
      <textarea
        id="code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={14}
        className="mt-2 w-full rounded border p-3 font-mono text-sm"
      />

      <button
        type="button"
        onClick={handleReview}
        disabled={loading || !code.trim()}
        className="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Reviewing…" : "Review my code"}
      </button>

      {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}
      {review && (
        <pre className="mt-6 whitespace-pre-wrap rounded bg-gray-50 p-4 text-sm text-black">{review}</pre>
      )}
    </main>
  );
}