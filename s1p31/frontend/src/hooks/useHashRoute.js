import { useEffect, useState } from 'react';

const read = () => String(window.location.hash || '').replace(/^#\/?/, '');

export function useHashRoute(validIds, fallback) {
  const [hash, setHash] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setHash(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return validIds.includes(hash) ? hash : fallback;
}
