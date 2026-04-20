import os

EXT_TO_LANGUAGE: dict[str, str] = {
    ".py":   "python",
    ".js":   "javascript",
    ".jsx":  "javascript",
    ".ts":   "typescript",
    ".tsx":  "typescript",
    ".html": "html",
    ".htm":  "html",
    ".css":  "css",
    ".json": "json",
    ".md":   "markdown",
    ".rs":   "rust",
    ".go":   "go",
    ".c":    "c",
    ".cpp":  "cpp",
    ".cc":   "cpp",
    ".cxx":  "cpp",
    ".h":    "c",
    ".hpp":  "cpp",
    ".java": "java",
    ".rb":   "ruby",
    ".sql":  "sql",
    ".cs":   "csharp",
}


def language_from_path(path: str) -> str:
    _, ext = os.path.splitext(path.lower())
    return EXT_TO_LANGUAGE.get(ext, "plaintext")
