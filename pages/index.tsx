import { Answer } from "@/components/Answer/Answer";
import { ExamplePrompts } from "@/components/ExamplePrompts";
import { Footer } from "@/components/Footer";
import { MemoryGraph } from "@/components/MemoryGraph";
import { Navbar } from "@/components/Navbar";
import { PassageCard } from "@/components/PassageCard";
import { DiscoveryPayload, MPChunk } from "@/types";
import {
  IconArrowRight,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconSun,
} from "@tabler/icons-react";
import endent from "endent";
import Head from "next/head";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type AppMode = "search" | "chat";

const SETTINGS_KEY_MATCH_COUNT = "MP_MATCH_COUNT";
const SETTINGS_KEY_MODE = "MP_MODE";
const SETTINGS_KEY_DARK = "MP_DARK_MODE";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [chunks, setChunks] = useState<MPChunk[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<AppMode>("chat");
  const [matchCount, setMatchCount] = useState(5);
  const [darkMode, setDarkMode] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryPayload | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState("");
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);

  const activeCluster = useMemo(
    () => discovery?.clusters.find((cluster) => cluster.id === activeClusterId) ?? discovery?.clusters[0] ?? null,
    [activeClusterId, discovery?.clusters],
  );

  const activePromptSet = useMemo(
    () =>
      discovery?.promptSets.find((promptSet) => promptSet.clusterId === activeCluster?.id) ??
      discovery?.promptSets[0] ??
      null,
    [activeCluster?.id, discovery?.promptSets],
  );

  const toggleDarkMode = () => {
    setDarkMode((previous) => {
      const next = !previous;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem(SETTINGS_KEY_DARK, next ? "1" : "0");
      return next;
    });
  };

  const focusInput = () => {
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const usePrompt = (prompt: string) => {
    setQuery(prompt);
    focusInput();
  };

  const fetchDiscovery = async () => {
    setDiscoveryLoading(true);
    setDiscoveryError("");

    try {
      const response = await fetch("/api/discovery");
      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const payload = (await response.json()) as DiscoveryPayload;
      setDiscovery(payload);
      setActiveClusterId((current) => current ?? payload.defaultClusterIds[0] ?? payload.clusters[0]?.id ?? null);
    } catch (error) {
      console.error(error);
      setDiscoveryError("Discovery surfaces are temporarily unavailable.");
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const fetchSearchResults = async () => {
    if (!query.trim()) {
      alert("Please enter a query.");
      return null;
    }

    setAnswer("");
    setChunks([]);
    setLoading(true);

    const searchResponse = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, matches: matchCount }),
    });

    if (!searchResponse.ok) {
      setLoading(false);
      throw new Error(searchResponse.statusText);
    }

    const results = (await searchResponse.json()) as MPChunk[];
    setChunks(results);
    return results;
  };

  const handleSearch = async () => {
    const results = await fetchSearchResults();
    setLoading(false);
    if (results) {
      focusInput();
    }
  };

  const handleAnswer = async () => {
    const results = await fetchSearchResults();
    if (!results) {
      return;
    }

    const prompt = endent`
    Use the following passages from my memory palace to answer the query: "${query}"

    query: "${query}"

    ${results.map((item) => item.content).join("\n\n")}
    `;

    const answerResponse = await fetch("/api/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!answerResponse.ok) {
      setLoading(false);
      throw new Error(answerResponse.statusText);
    }

    const data = answerResponse.body;
    if (!data) {
      setLoading(false);
      return;
    }

    setLoading(false);

    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      setAnswer((previous) => previous + chunkValue);
    }

    focusInput();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      if (mode === "search") {
        handleSearch();
      } else {
        handleAnswer();
      }
    }
  };

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY_MATCH_COUNT, matchCount.toString());
    localStorage.setItem(SETTINGS_KEY_MODE, mode);
    setShowSettings(false);
    focusInput();
  };

  const handleClear = () => {
    localStorage.removeItem(SETTINGS_KEY_MATCH_COUNT);
    localStorage.removeItem(SETTINGS_KEY_MODE);
    setMatchCount(5);
    setMode("chat");
  };

  useEffect(() => {
    if (matchCount > 10) {
      setMatchCount(10);
    } else if (matchCount < 1) {
      setMatchCount(1);
    }
  }, [matchCount]);

  useEffect(() => {
    const savedMatchCount = localStorage.getItem(SETTINGS_KEY_MATCH_COUNT);
    const savedMode = localStorage.getItem(SETTINGS_KEY_MODE);
    const savedDark = localStorage.getItem(SETTINGS_KEY_DARK);

    if (savedMatchCount) {
      setMatchCount(Number.parseInt(savedMatchCount, 10));
    }

    if (savedMode === "search" || savedMode === "chat") {
      setMode(savedMode);
    }

    if (savedDark === "1") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    void fetchDiscovery();
    focusInput();
  }, []);

  return (
    <>
      <Head>
        <title>Memory Palace</title>
        <meta name="description" content="Search, chat, and trace the idea graph behind Dino's Memory Palace." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-[linear-gradient(180deg,#f6f8f4_0%,#f3f6fb_42%,#eef4f8_100%)] text-slate-900 transition-colors duration-300 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)] dark:text-slate-100">
        <div className="px-4 pt-2">
          <div className="mx-auto flex min-w-0 w-full max-w-[1340px] items-center justify-between">
            <Navbar />
            <button
              className="ml-2 rounded-full border border-slate-300/80 bg-white/90 p-2 text-slate-800 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <IconSun size={22} /> : <IconMoon size={22} />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-4 pb-10">
          <div className="mx-auto flex min-w-0 w-full max-w-[1340px] flex-col gap-6 pt-4 sm:pt-8">
            <section className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(227,244,242,0.88)_38%,rgba(240,234,220,0.94)_100%)] px-5 py-6 shadow-[0_35px_120px_-60px_rgba(15,23,42,0.5)] dark:border-slate-700/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,118,110,0.14)_35%,rgba(120,53,15,0.16)_100%)] sm:px-8 sm:py-8">
              <div className="absolute -right-12 top-[-3rem] h-44 w-44 rounded-full bg-teal-300/30 blur-3xl dark:bg-teal-500/20" />
              <div className="absolute bottom-[-4rem] left-[-1rem] h-48 w-48 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-500/10" />

              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-teal-600/20 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-800 dark:border-teal-300/20 dark:bg-slate-900/60 dark:text-teal-200">
                      <IconSparkles size={14} />
                      Search-first, graph-backed
                    </div>
                    <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 dark:text-white sm:text-5xl">
                      Search what stuck.
                      <br />
                      Trace why it connects.
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-700 dark:text-slate-300 sm:text-base">
                      This is the front door to your memory palace: local passage search, LiteLLM-backed synthesis,
                      and a vault graph that turns hidden links into reusable prompts.
                    </p>
                  </div>

                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white/75 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:border-slate-600"
                    onClick={() => setShowSettings((current) => !current)}
                    type="button"
                  >
                    <IconSettings size={16} />
                    {showSettings ? "Hide settings" : "Show settings"}
                  </button>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  {(["chat", "search"] as AppMode[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        mode === option
                          ? "bg-slate-950 text-white shadow-lg dark:bg-white dark:text-slate-950"
                          : "border border-slate-300/80 bg-white/70 text-slate-700 hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-slate-600"
                      }`}
                      onClick={() => setMode(option)}
                    >
                      {option === "chat" ? "Chat with my palace" : "Search my passages"}
                    </button>
                  ))}
                </div>

                {showSettings && (
                  <div className="mt-5 max-w-xl rounded-[1.75rem] border border-white/80 bg-white/70 p-5 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/75">
                    <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Mode
                        <select
                          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          value={mode}
                          onChange={(event) => setMode(event.target.value as AppMode)}
                        >
                          <option value="chat">Chat</option>
                          <option value="search">Search</option>
                        </select>
                      </label>

                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Passages
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={matchCount}
                          onChange={(event) => setMatchCount(Number(event.target.value))}
                          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
                        onClick={handleSave}
                        type="button"
                      >
                        Save preferences
                      </button>
                      <button
                        className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200"
                        onClick={handleClear}
                        type="button"
                      >
                        Reset defaults
                      </button>
                    </div>
                  </div>
                )}

                <div className="relative mt-6">
                  <IconSearch className="absolute left-4 top-4 h-5 w-5 text-slate-400 dark:text-slate-500" />
                  <input
                    ref={inputRef}
                    className="h-16 w-full rounded-[1.7rem] border border-white/90 bg-white/90 pl-12 pr-16 text-base text-slate-900 shadow-[0_16px_50px_-35px_rgba(15,23,42,0.45)] outline-none ring-0 transition placeholder:text-slate-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/35 dark:border-slate-700 dark:bg-slate-950/90 dark:text-slate-100 dark:placeholder:text-slate-500 sm:text-lg"
                    type="text"
                    placeholder="Ask a question, or use a generated prompt..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button type="button">
                    <IconArrowRight
                      onClick={mode === "search" ? handleSearch : handleAnswer}
                      className="absolute right-3 top-3 h-10 w-10 rounded-full bg-teal-600 p-2 text-white transition hover:cursor-pointer hover:bg-teal-500"
                    />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="rounded-full border border-slate-300/80 bg-white/70 px-3 py-1 dark:border-slate-700 dark:bg-slate-900/70">
                    Mode: {mode}
                  </span>
                  <span className="rounded-full border border-slate-300/80 bg-white/70 px-3 py-1 dark:border-slate-700 dark:bg-slate-900/70">
                    Passage count: {matchCount}
                  </span>
                  {discovery?.model && (
                    <span className="rounded-full border border-slate-300/80 bg-white/70 px-3 py-1 dark:border-slate-700 dark:bg-slate-900/70">
                      LiteLLM: {discovery.model}
                    </span>
                  )}
                </div>
              </div>
            </section>

            {discoveryLoading ? (
              <div className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900/70">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-24 rounded-[1.5rem] bg-slate-200 dark:bg-slate-800" />
                  <div className="h-[320px] rounded-[1.5rem] bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            ) : discovery ? (
              <>
                <ExamplePrompts
                  clusterTitle={activeCluster?.title || "your current cluster"}
                  promptSet={activePromptSet}
                  stale={discovery.stale}
                  onUsePrompt={usePrompt}
                />

                <MemoryGraph
                  discovery={discovery}
                  activeClusterId={activeCluster?.id || null}
                  onSelectCluster={setActiveClusterId}
                  onSelectPrompt={usePrompt}
                />
              </>
            ) : (
              <div className="rounded-[2rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                {discoveryError || "Discovery surfaces are unavailable right now."}
              </div>
            )}

            {loading ? (
              <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900/70">
                <div className="animate-pulse space-y-4">
                  <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="mt-8 h-5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-24 rounded-[1.5rem] bg-slate-200 dark:bg-slate-800" />
                  <div className="h-24 rounded-[1.5rem] bg-slate-200 dark:bg-slate-800" />
                </div>
              </section>
            ) : answer ? (
              <section className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
                <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">
                    Answer
                  </div>
                  <Answer text={answer} />
                </div>

                <aside className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">
                      Supporting Passages
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {chunks.length} found
                    </span>
                  </div>

                  <div className="mt-5 flex flex-col gap-4">
                    {chunks.map((chunk, index) => (
                      <PassageCard key={`${chunk.content_title}-${index}`} chunk={chunk} />
                    ))}
                  </div>
                </aside>
              </section>
            ) : chunks.length > 0 ? (
              <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">
                    Search Results
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {chunks.length} passages
                  </span>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {chunks.map((chunk, index) => (
                    <PassageCard key={`${chunk.content_title}-${index}`} chunk={chunk} />
                  ))}
                </div>
              </section>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-slate-300/80 bg-white/60 px-5 py-5 text-sm leading-7 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                Start with a prompt, or walk the graph until an idea catches. Click generated prompts to seed the
                query box.
              </div>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
