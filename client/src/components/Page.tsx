import type { ReactNode } from 'react';
import { usePageMeta } from '../meta';

interface PageProps {
  title: string;
  description: string;
  path: string;
  heading: string;
  children?: ReactNode;
}

/** A tab page. Sets its own document title (E-1) and renders a main heading. */
export function Page({ title, description, path, heading, children }: PageProps) {
  usePageMeta(title, description, path);

  return (
    <main id="content" tabIndex={-1} className="main">
      <h1 className="h2">{heading}</h1>
      {children ?? (
        <p>
          This section is not built yet. When it is, every number will come from NASA Horizons
          through the one shared calculator, and every reply will name the model used (smooth Moon
          or terrain).
        </p>
      )}
    </main>
  );
}
