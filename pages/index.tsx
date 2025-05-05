import { Answer } from "@/components/Answer/Answer";
import { Footer } from "@/components/Footer";
import { ModelSelect } from '@/components/ModelSelect';
import { OpenAIModel } from '@/types/index';
import { Navbar } from "@/components/Navbar";
import { MPChunk } from "@/types";
import { IconArrowRight, IconExternalLink, IconSearch } from "@tabler/icons-react";
import { IconMoon, IconSun } from "@tabler/icons-react";
import endent from "endent";
import Head from "next/head";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { PassageCard } from "@/components/PassageCard";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState<string>("");
  const [chunks, setChunks] = useState<MPChunk[]>([]);
  const [answer, setAnswer] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [model, setModel] = useState<OpenAIModel>('gpt-4');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [mode, setMode] = useState<"search" | "chat">("chat");
  const [matchCount, setMatchCount] = useState<number>(5);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      if (typeof window !== 'undefined') {
        document.documentElement.classList.toggle('dark', newMode);
        localStorage.setItem('MP_DARK_MODE', newMode ? '1' : '0');
      }
      return newMode;
    });
  };

  const handleSearch = async () => {
    if (!query) {
      alert("Please enter a query.");
      return;
    }

    setAnswer("");
    setChunks([]);

    setLoading(true);

    const searchResponse = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query, matches: matchCount })
    });

    if (!searchResponse.ok) {
      setLoading(false);
      throw new Error(searchResponse.statusText);
    }

    const results: MPChunk[] = await searchResponse.json();
    setChunks(results);
    setLoading(false);
    inputRef.current?.focus();
    return results;
  };

  const handleAnswer = async () => {
    if (!query) {
      alert("Please enter a query.");
      return;
    }

    setAnswer("");
    setChunks([]);

    setLoading(true);

    const searchResponse = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query, matches: matchCount })
    });

    if (!searchResponse.ok) {
      setLoading(false);
      throw new Error(searchResponse.statusText);
    }

    const results: MPChunk[] = await searchResponse.json();

    setChunks(results);

    const prompt = endent`
    Use the following passages from my memory palace to provide an answer to the query: "${query}"

    ${results?.map((d: any) => d.content).join("\n\n")}
    `;

    const answerResponse = await fetch("/api/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    if (!answerResponse.ok) {
      setLoading(false);
      throw new Error(answerResponse.statusText);
    }

    const data = answerResponse.body;

    if (!data) {
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
      setAnswer((prev) => prev + chunkValue);
    }

    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (mode === "search") {
        handleSearch();
      } else {
        handleAnswer();
      }
    }
  };

  const handleSave = () => {
    localStorage.setItem("MP_MATCH_COUNT", matchCount.toString());
    localStorage.setItem("MP_MODE", mode);

    setShowSettings(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    localStorage.removeItem("MP_MATCH_COUNT");
    localStorage.removeItem("MP_MODE");

    setMatchCount(10);
    setMode("search");
  };

  useEffect(() => {
    if (matchCount > 10) {
      setMatchCount(10);
    } else if (matchCount < 1) {
      setMatchCount(1);
    }
  }, [matchCount]);

  useEffect(() => {
    const MP_MATCH_COUNT = localStorage.getItem("MP_MATCH_COUNT");
    const MP_MODE = localStorage.getItem("MP_MODE");
    const dark = localStorage.getItem('MP_DARK_MODE');

    if (MP_MATCH_COUNT) {
      setMatchCount(parseInt(MP_MATCH_COUNT));
    }

    if (MP_MODE) {
      setMode(MP_MODE as "search" | "chat");
    }

    if (dark === '1') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }

    inputRef.current?.focus();
  }, []);

  return (
    <>
      <Head>
        <title>Memory Palace</title>
        <meta
          name="description"
          content={`AI-powered search and chat for Dino's Memory Palace.`}
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <link
          rel="icon"
          href="/favicon.ico"
        />
      </Head>

      <div className="flex flex-col h-screen bg-white dark:bg-zinc-900 transition-colors duration-300">
        <div className="flex items-center justify-between px-4 pt-2">
          <Navbar />
          <button
            className="ml-2 p-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
          >
            {darkMode ? <IconSun size={22} /> : <IconMoon size={22} />}
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <div className="mx-auto flex h-full w-full max-w-[750px] flex-col items-center px-3 pt-4 sm:pt-8">
            <button
              className="mt-4 flex cursor-pointer items-center space-x-2 rounded-full border border-zinc-600 dark:border-zinc-400 px-3 py-1 text-sm hover:opacity-50 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
              onClick={() => setShowSettings(!showSettings)}
            >
              {showSettings ? "Hide" : "Show"} Settings
            </button>

            {showSettings && (
              <div className="w-[340px] sm:w-[400px]">
                <div>
                  <div>Model</div>
                  <select
                    className="max-w-[400px] block w-full cursor-pointer rounded-md border border-gray-300 dark:border-zinc-600 p-2 text-black dark:text-zinc-100 bg-white dark:bg-zinc-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                    value={model}
                    onChange={(e) => setModel(e.target.value as "gpt-4o-mini" | "gpt-4")}
                  >
                    <option value="gpt-4o-mini">GPT-4O-MINI</option>
                    <option value="gpt-4">GPT-4</option>
                  </select>
                </div>

                <div>
                  <div>Mode</div>
                  <select
                    className="max-w-[400px] block w-full cursor-pointer rounded-md border border-gray-300 dark:border-zinc-600 p-2 text-black dark:text-zinc-100 bg-white dark:bg-zinc-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as "search" | "chat")}
                  >
                    <option value="search">Search</option>
                    <option value="chat">Chat</option>
                  </select>
                </div>

                <div className="mt-2">
                  <div>Passage Count</div>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={matchCount}
                    onChange={(e) => setMatchCount(Number(e.target.value))}
                    className="max-w-[400px] block w-full rounded-md border border-gray-300 dark:border-zinc-600 p-2 text-black dark:text-zinc-100 bg-white dark:bg-zinc-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  />
                </div>

                <div className="mt-4 flex space-x-2 justify-center">
                  <div
                    className="flex cursor-pointer items-center space-x-2 rounded-full bg-green-500 px-3 py-1 text-sm text-white hover:bg-green-600"
                    onClick={handleSave}
                  >
                    Save
                  </div>

                  <div
                    className="flex cursor-pointer items-center space-x-2 rounded-full bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                    onClick={handleClear}
                  >
                    Clear
                  </div>
                </div>
              </div>
            )}

            <div className="relative w-full mt-4">
              <IconSearch className="absolute top-3 w-10 left-1 h-6 rounded-full opacity-50 sm:left-3 sm:top-4 sm:h-8" />

              <input
                ref={inputRef}
                className="h-12 w-full rounded-full border border-zinc-600 dark:border-zinc-400 pr-12 pl-11 focus:border-zinc-800 dark:focus:border-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-800 dark:focus:ring-zinc-100 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 sm:h-16 sm:py-2 sm:pr-16 sm:pl-16 sm:text-lg"
                type="text"
                placeholder="What did I learn so far?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />

              <button>
                <IconArrowRight
                  onClick={mode === "search" ? handleSearch : handleAnswer}
                  className="absolute right-2 top-2.5 h-7 w-7 rounded-full bg-blue-500 p-1 hover:cursor-pointer hover:bg-blue-600 sm:right-3 sm:top-3 sm:h-10 sm:w-10 text-white"
                />
              </button>
            </div>
            

            {loading ? (
              <div className="mt-6 w-full">
                {mode === "chat" && (
                  <>
                    <div className="font-bold text-2xl text-zinc-900 dark:text-zinc-100">Answer</div>
                    <div className="animate-pulse mt-2">
                      <div className="h-4 bg-gray-300 rounded"></div>
                      <div className="h-4 bg-gray-300 rounded mt-2"></div>
                      <div className="h-4 bg-gray-300 rounded mt-2"></div>
                      <div className="h-4 bg-gray-300 rounded mt-2"></div>
                      <div className="h-4 bg-gray-300 rounded mt-2"></div>
                    </div>
                  </>
                )}

                <div className="font-bold text-2xl mt-6 text-zinc-900 dark:text-zinc-100">Passages</div>
                <div className="animate-pulse mt-2">
                  <div className="h-4 bg-gray-300 rounded"></div>
                  <div className="h-4 bg-gray-300 rounded mt-2"></div>
                  <div className="h-4 bg-gray-300 rounded mt-2"></div>
                  <div className="h-4 bg-gray-300 rounded mt-2"></div>
                  <div className="h-4 bg-gray-300 rounded mt-2"></div>
                </div>
              </div>
            ) : answer ? (
              <div className="mt-6 flex flex-col md:flex-row gap-8 w-full">
                <div className="flex-1 min-w-[320px] md:max-w-[65%]">
                  <div className="font-bold text-2xl mb-2 text-zinc-900 dark:text-zinc-100">Answer</div>
                  <div className="mb-6">
                    <Answer text={answer} />
                  </div>
                </div>
                <aside className="w-full md:w-[35%] max-w-[400px] flex-shrink-0">
                  <div className="font-bold text-2xl mb-2 flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                    <span>Passages</span>
                    <span className="text-xs font-normal text-zinc-400">({chunks.length} found)</span>
                  </div>
                  <div className="flex flex-col gap-4">
                    {chunks.map((chunk, index) => (
                      <PassageCard key={index} chunk={chunk} />
                    ))}
                  </div>
                </aside>
              </div>
            ) : chunks.length > 0 ? (
              <div className="mt-6 pb-16">
                <div className="font-bold text-2xl text-zinc-900 dark:text-zinc-100">Passages</div>
                {chunks.map((chunk, index) => (
                  <div key={index}>
                    <div className="mt-4 border border-zinc-600 rounded-lg p-4">
                      <div className="flex justify-between">
                        <div>
                          <div className="font-bold text-xl">{chunk.content_title}</div>
                          <div className="mt-1 font-bold text-sm">{chunk.content_date}</div>
                        </div>
                        <a
                          className="hover:opacity-50 ml-2"
                          href={chunk.content_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <IconExternalLink />
                        </a>
                      </div>
                      <div className="mt-2">{chunk.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 text-center text-lg text-zinc-800 dark:text-zinc-100">{`AI-powered search & chat for my Memory Palace`}</div>
            )}
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
