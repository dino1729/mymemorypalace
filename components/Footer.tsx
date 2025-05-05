import { IconBrandGithub, IconBrandTwitter } from "@tabler/icons-react";
import { FC } from "react";

export const Footer: FC = () => {
  return (
    <div className="flex h-[50px] border-t border-gray-300 py-2 px-8 items-center justify-between relative text-sm">
      <div className="flex items-center min-w-[120px]">
        <span className="text-zinc-500">dinozard.com</span>
      </div>
      <div className="flex-1 flex justify-center">
        <span className="italic text-zinc-700 dark:text-zinc-300">Created by Dinozard based on the analysis of LLM Bot.</span>
      </div>
      <div className="flex items-center space-x-4 min-w-[60px] justify-end">
        <a
          className="flex items-center hover:opacity-50"
          href="https://twitter.com/dino1729"
          target="_blank"
          rel="noreferrer"
        >
          <IconBrandTwitter size={20} />
        </a>
        <a
          className="flex items-center hover:opacity-50"
          href="https://github.com/dino1729/"
          target="_blank"
          rel="noreferrer"
        >
          <IconBrandGithub size={20} />
        </a>
      </div>
    </div>
  );
};
