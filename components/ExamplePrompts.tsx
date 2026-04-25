import { ClusterPromptSet } from "@/types";
import { IconArrowUpRight, IconClockHour4 } from "@tabler/icons-react";
import React from "react";

type ExamplePromptsProps = {
  clusterTitle: string;
  promptSet: ClusterPromptSet | null;
  stale: boolean;
  onUsePrompt: (prompt: string) => void;
};

export const ExamplePrompts: React.FC<ExamplePromptsProps> = ({
  clusterTitle,
  promptSet,
  stale,
  onUsePrompt,
}) => {
  const prompts = promptSet?.prompts ?? [];

  return (
    <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">
            Example Prompts
          </p>
          <h2 className="mt-1 break-words text-xl font-semibold text-slate-900 dark:text-slate-50">
            Generated from {clusterTitle}
          </h2>
        </div>

        {stale && (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100/90 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-200">
            <IconClockHour4 size={14} />
            Using cached prompts
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            className="group min-w-0 rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-[0_20px_50px_-30px_rgba(20,184,166,0.55)] dark:border-slate-700 dark:from-slate-900 dark:to-slate-800 dark:hover:border-teal-400"
            onClick={() => onUsePrompt(prompt)}
            type="button"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <p className="min-w-0 break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{prompt}</p>
              <IconArrowUpRight
                size={18}
                className="mt-1 flex-shrink-0 text-teal-700 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:text-teal-300"
              />
            </div>
          </button>
        ))}

        {prompts.length === 0 && (
          <div className="rounded-[1.5rem] border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Prompt generation is warming up. The graph is still fully usable.
          </div>
        )}
      </div>
    </section>
  );
};
