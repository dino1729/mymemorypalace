import { FC } from "react";

export const Navbar: FC = () => {
  return (
    <div className="flex h-[60px] py-2 px-8 items-center justify-between bg-white dark:bg-zinc-900 transition-colors">
      <div className="font-bold text-2xl flex items-center text-zinc-900 dark:text-zinc-100">
        My Memory Palace
      </div>
      {/* Removed external link and underline */}
    </div>
  );
};
