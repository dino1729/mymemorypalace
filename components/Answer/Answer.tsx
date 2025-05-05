import React from "react";
import styles from "./answer.module.css";

interface AnswerProps {
  text: string;
}

// Helper to parse text into paragraphs and lists, and bold **text**
function parseAnswer(text: string) {
  const lines = text.split(/\r?\n/);
  const blocks: Array<{ type: 'ul' | 'ol' | 'p'; items?: string[]; text?: string }> = [];
  let currentList: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  // Helper to bold **text**
  const boldify = (str: string) => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^[-*•]\s+/.test(trimmed)) {
      // Unordered list
      if (listType !== 'ul') {
        if (currentList.length) blocks.push({ type: listType!, items: currentList });
        currentList = [];
        listType = 'ul';
      }
      currentList.push(trimmed.replace(/^[-*•]\s+/, ''));
    } else if (/^\d+\.\s+/.test(trimmed)) {
      // Ordered list
      if (listType !== 'ol') {
        if (currentList.length) blocks.push({ type: listType!, items: currentList });
        currentList = [];
        listType = 'ol';
      }
      currentList.push(trimmed.replace(/^\d+\.\s+/, ''));
    } else if (trimmed) {
      if (currentList.length) blocks.push({ type: listType!, items: currentList });
      currentList = [];
      listType = null;
      blocks.push({ type: 'p', text: trimmed });
    }
  });
  if (currentList.length) blocks.push({ type: listType!, items: currentList });
  return { blocks, boldify };
}

export const Answer: React.FC<AnswerProps> = ({ text }) => {
  const { blocks, boldify } = parseAnswer(text);
  return (
    <div className="bg-zinc-100 dark:bg-zinc-900 rounded-xl p-5 text-base sm:text-lg leading-relaxed shadow-md border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100">
      {blocks.map((block, i) => {
        if (block.type === 'ul') {
          return (
            <ul key={i} className="list-disc ml-6 my-2">
              {block.items!.map((item, idx) => (
                <li key={idx} className={styles.fadeIn} style={{ animationDelay: `${idx * 0.01}s` }}>{boldify(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={i} className="list-decimal ml-6 my-2">
              {block.items!.map((item, idx) => (
                <li key={idx} className={styles.fadeIn} style={{ animationDelay: `${idx * 0.01}s` }}>{boldify(item)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className={styles.fadeIn} style={{ animationDelay: `${i * 0.01}s` }}>{boldify(block.text || "")}</p>
        );
      })}
    </div>
  );
};
