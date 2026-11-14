import { useEffect, type ReactNode } from 'react';

interface PageProps {
  title: string;
  heading: string;
  children?: ReactNode;
}

/** A tab page. Sets its own document title (E-1) and renders a main heading. */
export function Page({ title, heading, children }: PageProps) {
  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <main id="content" className="main">
      <h1 className="h2">{heading}</h1>
      {children ?? (
        <p>
          This section is scaffolded. Real data and behaviour arrive as the build blocks
          land. Every number will come from NASA Horizons, computed by one shared
          calculator, and every reply will name the model used (smooth Moon or terrain).
        </p>
      )}
    </main>
  );
}
