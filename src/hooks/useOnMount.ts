import { useState, useEffect } from 'react';

export default function useOnMount() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
