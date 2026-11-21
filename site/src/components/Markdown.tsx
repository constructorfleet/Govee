import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: false });

export function Markdown({ md }: { md: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(md) as string;
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  }, [md]);
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
