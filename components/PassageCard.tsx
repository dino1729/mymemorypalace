import { IconExternalLink } from "@tabler/icons-react";
import { MPChunk } from "@/types";
import React, { useState } from "react";

interface PassageCardProps {
  chunk: MPChunk;
}

export const PassageCard: React.FC<PassageCardProps> = ({ chunk }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm hover:shadow-lg transition-shadow cursor-pointer text-zinc-900 dark:text-zinc-50"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex justify-between items-center p-4">
        <div>
          <div className="font-semibold text-base text-blue-700 dark:text-blue-200 flex items-center gap-2">
            <span>{chunk.content_title}</span>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-300 mt-1">{chunk.content_date}</div>
        </div>
        <a
          className="hover:opacity-60 ml-2 text-blue-600 dark:text-blue-300"
          href={chunk.content_url}
          target="_blank"
          rel="noreferrer"
          title="Open Source"
          onClick={e => e.stopPropagation()}
        >
          <IconExternalLink />
        </a>
      </div>
      {expanded && (
        <div className="text-zinc-800 dark:text-zinc-100 leading-relaxed whitespace-pre-line px-4 pb-4">
          {chunk.content}
        </div>
      )}
      {!expanded && (
        <div className="px-4 pb-4 text-zinc-600 dark:text-zinc-300 text-sm truncate" style={{maxHeight: '3.5em', overflow: 'hidden'}}>
          {chunk.content}
        </div>
      )}
    </div>
  );
};
