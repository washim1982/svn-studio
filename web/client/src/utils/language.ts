const EXTENSION_LANGUAGE: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript React",
  js: "JavaScript",
  jsx: "JavaScript React",
  json: "JSON",
  css: "CSS",
  html: "HTML",
  md: "Markdown",
  py: "Python",
  java: "Java",
  cs: "C#",
  xml: "XML",
  yml: "YAML",
  yaml: "YAML",
  sql: "SQL",
  sh: "Shell",
};

const MONACO_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  css: "css",
  html: "html",
  md: "markdown",
  py: "python",
  java: "java",
  cs: "csharp",
  xml: "xml",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  sh: "shell",
};

function extOf(path: string | null): string {
  if (!path) return "";
  return path.split(".").pop()?.toLowerCase() ?? "";
}

export function monacoLanguageFromPath(path: string | null): string {
  return MONACO_LANGUAGE[extOf(path)] ?? "plaintext";
}

export function displayLanguageFromPath(path: string | null): string {
  if (!path) return "Plain Text";
  return EXTENSION_LANGUAGE[extOf(path)] ?? "Plain Text";
}
