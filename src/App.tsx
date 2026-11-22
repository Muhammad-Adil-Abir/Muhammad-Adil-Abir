import { useEffect } from 'react';
import { Arrival } from './components/Arrival';
import { ChapterRail, Nav } from './components/Chrome';
import { FinalProtocol } from './components/FinalProtocol';
import { LaunchArchive } from './components/LaunchArchive';
import { Manifesto, Transmission, Work } from './components/Sections';
import { useSettings } from './lib/settings';

export function App() {
  const { reducedMotion } = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('motion-ok', !reducedMotion);
    root.classList.toggle('motion-reduced', reducedMotion);
  }, [reducedMotion]);

  return (
    <>
      <a className="skip-link" href="#manifesto">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Arrival />
        <Manifesto />
        <Work />
        <LaunchArchive />
        <Transmission />
        <FinalProtocol />
      </main>
      <ChapterRail />
    </>
  );
}
