import Markdown from "react-markdown";

// Text written by the model is untrusted. react-markdown never renders raw HTML, and
// this list also leaves out links and images; anything else is unwrapped to plain text.
const ALLOWED = ["p", "code", "strong", "em", "ul", "ol", "li", "pre"];

export function ModelText({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div
      className={`prose prose-slate max-w-none text-ink prose-p:my-1 prose-code:before:content-none prose-code:after:content-none ${className}`}
    >
      <Markdown allowedElements={ALLOWED} unwrapDisallowed>
        {children}
      </Markdown>
    </div>
  );
}
