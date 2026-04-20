"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";

interface Props {
  htmlContent: string;
  roomId: string;
}

/**
 * Renders an HTML file in a sandboxed iframe.
 * Inlines linked CSS/JS files that exist in the room's file tree,
 * so multi-file web projects render correctly without a real server.
 */
export function WebPreview({ htmlContent, roomId }: Props) {
  const files = useEditorStore(s => s.files);
  const fileContents = useEditorStore(s => s.fileContents);

  const srcdoc = useMemo(() => {
    let html = htmlContent;

    // Inline <link rel="stylesheet" href="./foo.css"> from the file tree
    html = html.replace(
      /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*\/?>/gi,
      (match, href) => {
        const file = findFileByHref(files, href);
        if (!file) return match;
        const content = fileContents[file.id] ?? "";
        return `<style>/* ${file.path} */\n${content}</style>`;
      }
    );

    // Inline <script src="./foo.js"> from the file tree
    html = html.replace(
      /<script([^>]+)src=["']([^"']+)["']([^>]*)><\/script>/gi,
      (match, pre, src, post) => {
        const file = findFileByHref(files, src);
        if (!file) return match;
        const content = fileContents[file.id] ?? "";
        return `<script${pre}${post}>\n/* ${file.path} */\n${content}\n</script>`;
      }
    );

    return html;
  }, [htmlContent, files, fileContents]);

  return (
    <iframe
      srcDoc={srcdoc}
      sandbox="allow-scripts allow-forms allow-modals allow-popups"
      className="web-preview-frame"
      title="Web Preview"
    />
  );
}

function findFileByHref(files: { path: string; name: string }[], href: string) {
  // Strip leading ./ or /
  const clean = href.replace(/^\.?\//, "");
  return files.find(f => f.path === clean || f.name === clean || f.path.endsWith("/" + clean));
}
