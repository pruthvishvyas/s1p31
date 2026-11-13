import { useData } from './useData.js';
import { adaptContract } from '../utils/adapters.js';
import { CONTRACT_PATH } from '../utils/datasets.js';

export function useContract() {
  return useData(CONTRACT_PATH, adaptContract);
}
