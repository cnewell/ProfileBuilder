"use client";

import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [textResponse, setTextResponse] = useState("");
  const [jsonResponse, setJsonResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setTextResponse("");
    setJsonResponse("");
    setLoading(true);

    try {
      const response = await fetch("/api/analyze-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      let buffer = "";
      let currentText = "";
      let currentJson = "";
      let jsonComplete = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += new TextDecoder().decode(value);
        const events = buffer.split("\n\n");
        buffer = events[events.length - 1];

        for (let i = 0; i < events.length - 1; i++) {
          const event = events[i].trim();
          if (!event) continue;

          const lines = event.split("\n");
          for (const line of lines) {
            if (line.startsWith("event:")) {
              const eventType = line.slice(6).trim();
              if (eventType === "json_end") {
                jsonComplete = true;
              }
            } else if (line.startsWith("data:")) {
              const dataStr = line.slice(5).trim();
              if (!dataStr) continue;

              try {
                const data = JSON.parse(dataStr);
                if (data.type === "text_chunk" && data.content) {
                  currentText += data.content;
                  setTextResponse(currentText);
                } else if (data.type === "json_chunk" && data.content) {
                  currentJson += data.content;
                } else if (data.error) {
                  setError(data.error);
                }
              } catch {
                // Ignore parsing errors
              }
            }
          }
        }
      }

      // Parse and pretty-print JSON after complete
      if (currentJson.trim() && jsonComplete) {
        try {
          const parsed = JSON.parse(currentJson);
          setJsonResponse(JSON.stringify(parsed, null, 2));
        } catch {
          setJsonResponse(currentJson);
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Travel Preference Analyzer
          </h1>
          <p className="text-gray-600 mb-8">
            Describe your travel preferences and get insights powered by Claude
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <div>
              <label
                htmlFor="prompt"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Describe your travel preferences:
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., I love visiting sunny beaches and relaxing at resorts. I'm also interested in exploring historical sites and trying local cuisine. Adventure activities like hiking appeal to me, and I prefer boutique hotels..."
                className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-black"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Analyzing..." : "Analyze Preferences"}
            </button>
          </form>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preference Summary:
              </label>
              <textarea
                value={textResponse}
                readOnly
                className="flex-1 p-4 border border-gray-300 rounded-lg bg-gray-50 font-sans text-sm resize-none text-black"
                placeholder="Text response will appear here..."
              />
            </div>

            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferences (JSON):
              </label>
              <textarea
                value={jsonResponse}
                readOnly
                className="flex-1 p-4 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm resize-none text-black"
                placeholder="JSON response will appear here..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
