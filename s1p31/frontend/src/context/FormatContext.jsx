import { createContext, useContext, useMemo } from 'react';
import { useDataset } from '../hooks/useDataset.js';
import { createFormatter } from '../utils/formatters.js';

const FormatContext = createContext(createFormatter(null));

export function FormatProvider({ children }) {
  const summary = useDataset('summary');
  const value = useMemo(() => createFormatter(summary.data), [summary.data]);
  return <FormatContext.Provider value={value}>{children}</FormatContext.Provider>;
}

export function useFormat() {
  return useContext(FormatContext);
}
