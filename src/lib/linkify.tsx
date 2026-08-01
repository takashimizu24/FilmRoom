import type { ReactNode } from "react";

// Bare URLs and email addresses as people type them: an explicit http(s)
// scheme, a `www.` host we can safely assume is https, or an address we can
// turn into a `mailto:`. Nothing else is matched, so a pasted `javascript:`
// string can never become an href. The URL branch comes first so the host part
// of `https://user@example.com/x` isn't mistaken for an address, and the
// address local part is restricted to email-legal characters so it can't run
// backwards into adjoining Japanese text that has no spaces.
const LINK_RE =
  /(?:https?:\/\/|www\.)[^\s<>"']+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi;

function hrefFor(match: string): string {
  const lower = match.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return match;
  if (lower.startsWith("www.")) return `https://${match}`;
  return `mailto:${match}`;
}

// Punctuation at the end of a match is almost always the sentence's, not the
// URL's. Closing brackets are only trimmed when they have no opener inside the
// URL, so Wikipedia-style `..._(disambiguation)` links stay intact.
function trimTrailingPunctuation(url: string): string {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if (".,;:!?'\"".includes(ch)) {
      end--;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      const open = ch === ")" ? "(" : ch === "]" ? "[" : "{";
      const slice = url.slice(0, end);
      const opens = slice.split(open).length - 1;
      const closes = slice.split(ch).length - 1;
      if (closes > opens) {
        end--;
        continue;
      }
    }
    break;
  }
  return url.slice(0, end);
}

// Splits user-written text into plain strings and clickable anchors. Returns
// the original string untouched when there is no link, so callers can drop this
// in wherever they were rendering `{text}`.
export function linkify(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(LINK_RE)) {
    const link = trimTrailingPunctuation(match[0]);
    if (!link) continue;
    const start = match.index;
    if (start > last) nodes.push(text.slice(last, start));
    const href = hrefFor(link);
    // Only web links open a tab; a `mailto:` would hand off to the mail client
    // and strand an empty tab behind it.
    const external = !href.startsWith("mailto:");
    nodes.push(
      <a
        key={key++}
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className="text-sky-400 hover:text-sky-300 underline underline-offset-2 break-words transition"
      >
        {link}
      </a>
    );
    last = start + link.length;
  }

  if (nodes.length === 0) return text;
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
