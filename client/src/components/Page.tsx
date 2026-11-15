import type { ReactNode } from 'react';
import { usePageMeta } from '../meta';

interface PageProps {
  title: string;
  description: string;
  path: string;
  heading: string;
  children: ReactNode;
}

/** A tab page. Sets its own document title (E-1) and renders a main heading. */
export function Page({ title, description, path, heading, children }: PageProps) {
  usePageMeta(title, description, path);

  return (
    <main id="content" tabIndex={-1} className="main">
      <h1 className="h2">{heading}</h1>
      {children}
    </main>
  );
}
