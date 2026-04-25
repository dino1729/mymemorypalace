import { FC } from "react";

export const Navbar: FC = () => {
  return (
    <div className="flex h-[60px] items-center justify-between py-2">
      <div className="flex items-baseline gap-3">
        <div className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-slate-50">
          My Memory Palace
        </div>
        <div className="hidden rounded-full border border-slate-300/80 bg-white/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:block">
          Local search • LiteLLM
        </div>
      </div>
    </div>
  );
};
