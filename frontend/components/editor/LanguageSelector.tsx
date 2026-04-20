"use client";

import { LANGUAGE_LABELS } from "@/lib/utils/language";
import { useEditorStore } from "@/store/editorStore";

const LANGUAGES = [
  "python", "javascript", "typescript",
  "c", "cpp", "csharp", "java", "rust", "go", "ruby",
  "html", "css", "sql", "json", "markdown",
];

interface Props {
  onLanguageChange: (lang: string) => void;
}

export function LanguageSelector({ onLanguageChange }: Props) {
  const activeFileId = useEditorStore(s => s.activeFileId);
  const getFileLanguage = useEditorStore(s => s.getFileLanguage);
  const language = activeFileId ? getFileLanguage(activeFileId) : "python";

  return (
    <select
      className="language-select"
      aria-label="Programming language"
      value={language}
      onChange={e => onLanguageChange(e.target.value)}
    >
      {LANGUAGES.map(l => (
        <option key={l} value={l}>{LANGUAGE_LABELS[l] ?? l}</option>
      ))}
    </select>
  );
}
