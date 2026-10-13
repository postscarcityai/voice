import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders generated reports. No raw HTML, so model output can't inject markup. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-voice">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
