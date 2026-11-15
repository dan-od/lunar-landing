// Per-tab title, description and canonical address (search and sharing pass).
// The canonical address is the tab without the scenario parameters, so every
// shared scenario link points search engines at one page per tab.
import { useEffect } from 'react';

function setMeta(selector: string, attribute: string, value: string): void {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attribute, value);
}

export function usePageMeta(title: string, description: string, path: string): void {
  useEffect(() => {
    const url = `${window.location.origin}${path}`;
    document.title = title;
    setMeta('meta[name="description"]', 'content', description);
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);
  }, [title, description, path]);
}
