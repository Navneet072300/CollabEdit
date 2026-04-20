const EXT_MAP: Record<string, string> = {
  ".py": "python", ".js": "javascript", ".jsx": "javascript",
  ".ts": "typescript", ".tsx": "typescript",
  ".html": "html", ".htm": "html",
  ".css": "css", ".json": "json", ".md": "markdown",
  ".rs": "rust", ".go": "go",
  ".c": "c", ".h": "c",
  ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp", ".hpp": "cpp",
  ".java": "java", ".rb": "ruby", ".sql": "sql", ".cs": "csharp",
};

export function languageFromPath(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "plaintext";
  return EXT_MAP[path.slice(dot).toLowerCase()] ?? "plaintext";
}

export const LANGUAGE_LABELS: Record<string, string> = {
  python: "Python", javascript: "JavaScript", typescript: "TypeScript",
  html: "HTML", css: "CSS", json: "JSON", markdown: "Markdown",
  rust: "Rust", go: "Go", c: "C", cpp: "C++",
  java: "Java", ruby: "Ruby", sql: "SQL", csharp: "C#",
  plaintext: "Plain Text",
};

export const FILE_ICON: Record<string, string> = {
  python: "🐍", javascript: "🟨", typescript: "🔷",
  html: "🌐", css: "🎨", json: "📋", markdown: "📝",
  rust: "🦀", go: "🐹", c: "⚙️", cpp: "⚙️",
  java: "☕", ruby: "💎", sql: "🗄️", csharp: "🔷",
  plaintext: "📄",
};

export const DEFAULT_FILENAME: Record<string, string> = {
  python: "main.py", javascript: "index.js", typescript: "index.ts",
  html: "index.html", css: "style.css", json: "data.json",
  markdown: "README.md", rust: "main.rs", go: "main.go",
  c: "main.c", cpp: "main.cpp", java: "Main.java",
  ruby: "main.rb", sql: "query.sql", csharp: "Program.cs",
};

export const WEB_LANGUAGES = new Set(["html", "css", "javascript", "typescript"]);
export const RUNNABLE_LANGUAGES = new Set([
  "python", "javascript", "typescript", "go", "rust",
  "c", "cpp", "java", "ruby", "sql", "csharp",
]);
