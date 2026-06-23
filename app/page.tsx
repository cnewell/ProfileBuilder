"use client";

import { useState } from "react";

type Message = {
  role: string;
  content: string;
};

type PreferencesObject = {
  preferences: Array<{
    name: string;
    "legal-values": string[];
    preferred: string[];
    forbidden: string[];
  }>;
};

const DEFAULT_PREFERENCES: PreferencesObject = {
  preferences: [
    {
      name: "Month of Travel",
      "legal-values": [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ],
      preferred: [],
      forbidden: [],
    },
    {
      name: "Region",
      "legal-values": [
        "North America",
        "Central America",
        "South America",
        "Caribbean",
        "Western Europe",
        "Eastern Europe",
        "North Africa",
        "Sub-Saharan Africa",
        "Middle East",
        "Central Asia",
        "East Asian and Japan",
        "Australia and Pacific Islands",
      ],
      preferred: [],
      forbidden: [],
    },
    {
      name: "Duration",
      "legal-values": [
        "Day Trip",
        "Weekend",
        "One Week",
        "Two Weeks",
        "More than two weeks",
      ],
      preferred: [],
      forbidden: [],
    },
  ],
};

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [textResponse, setTextResponse] = useState("");
  const [jsonResponse, setJsonResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [preferences, setPreferences] = useState<PreferencesObject>(
    DEFAULT_PREFERENCES
  );

  const getPreferences = (): PreferencesObject => {
    if (typeof window === "undefined") return DEFAULT_PREFERENCES;
    const stored = localStorage.getItem("preferences");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return DEFAULT_PREFERENCES;
      }
    }
    return DEFAULT_PREFERENCES;
  };

  const savePreferences = (prefs: PreferencesObject) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("preferences", JSON.stringify(prefs));
      setPreferences(prefs);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setTextResponse("");
    setJsonResponse("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: prompt }]);

    try {
      const currentPreferences = getPreferences();
      const newMessages: Message[] = [
        ...messages,
        { role: "user", content: prompt },
      ];

      const response = await fetch("/api/analyze-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          preferences: currentPreferences,
        }),
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

      const formattedHistory = messages
        .map((msg) => msg.content)
        .join("\n\n");
      if (formattedHistory) {
        setTextResponse(formattedHistory + "\n\n");
      }

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
          const filteredJson = currentJson
            .split("\n")
            .filter((line) => !line.trim().startsWith("```"))
            .join("\n");
          const parsed = JSON.parse(filteredJson);
          setJsonResponse(JSON.stringify(parsed, null, 2));
          if (parsed && parsed.preferences) {
            savePreferences(parsed);
          }
        } catch {
          setJsonResponse(currentJson);
        }
      }

      if (currentText.trim()) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: currentText },
        ]);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPrompt("");
    setTextResponse("");
    setJsonResponse("");
    setMessages([]);
    setError("");
    savePreferences(DEFAULT_PREFERENCES);
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

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="flex-1 bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Analyzing..." : "Analyze Preferences"}
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={loading}
                className="flex-1 bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Clear
              </button>
            </div>
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
              <div className="flex-1 p-4 border border-gray-300 rounded-lg bg-gray-50 font-sans text-sm overflow-y-auto text-black whitespace-pre-wrap">
                {messages.length === 0 && !textResponse ? (
                  <span className="text-gray-400">Text response will appear here...</span>
                ) : (
                  <>
                    {messages.map((msg, idx) => (
                      <div key={idx} className="mb-4">
                        {msg.role === "user" ? (
                          <em>{msg.content}</em>
                        ) : (
                          msg.content
                        )}
                      </div>
                    ))}
                    {textResponse && (
                      <div>
                        {textResponse.split("\n").map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
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
