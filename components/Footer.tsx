import { IconBrandGithub, IconBrandTwitter } from "@tabler/icons-react";
import { FC } from "react";

export const Footer: FC = () => {
  return (
    <div className="mt-8 border-t border-slate-200/80 px-4 py-4 text-sm dark:border-slate-800">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-[120px] text-xs uppercase tracking-[0.18em]">dinozard.com</div>
        <div className="flex-1 text-center italic text-slate-600 dark:text-slate-300">
          Search local memories, then follow the connections.
        </div>
        <div className="flex min-w-[60px] items-center justify-center gap-4 sm:justify-end">
          <a
            className="flex items-center transition hover:opacity-60"
            href="https://twitter.com/dino1729"
            target="_blank"
            rel="noreferrer"
          >
            <IconBrandTwitter size={20} />
          </a>
          <a
            className="flex items-center transition hover:opacity-60"
            href="https://github.com/dino1729/"
            target="_blank"
            rel="noreferrer"
          >
            <IconBrandGithub size={20} />
          </a>
        </div>
      </div>
    </div>
  );
};
