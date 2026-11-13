import { createContext, useContext } from 'react';
import { useContract } from '../hooks/useContract.js';

const DEFAULTS = { revenue: 'Revenue', customer: 'Customer', product: 'Product', transaction: 'Transaction' };
const TermContext = createContext(DEFAULTS);

function pluralize(word) {
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  if (/(s|x|ch|sh)$/i.test(word)) return word + 'es';
  return word + 's';
}

export function TerminologyProvider({ children }) {
  const contract = useContract();
  const terms = contract.data ? contract.data.terminology : DEFAULTS;
  return <TermContext.Provider value={terms}>{children}</TermContext.Provider>;
}

export function useTerm() {
  const terms = useContext(TermContext);
  return (key, options) => {
    const opts = options || {};
    let word = terms[key] || DEFAULTS[key] || key;
    if (opts.plural) word = pluralize(word);
    return opts.lower ? word.toLowerCase() : word;
  };
}
