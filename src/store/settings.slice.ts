import type { StateCreator } from 'zustand';
import type { ApiKeys, Provider, Validations } from '../types';
import { llmService } from '../services/llmService';

export type SettingsSlice = {
  keys: ApiKeys;
  validations: Validations;
  drawerOpen: boolean;
  validating: boolean;
  setKey: (provider: Provider, value: string) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  validateAll: () => Promise<void>;
  clearKeys: () => void;
};

const emptyKeys: ApiKeys = { fal: '', eleven: '', openai: '', anthropic: '' };
const emptyValidations: Validations = {
  fal: 'unchecked',
  eleven: 'unchecked',
  openai: 'unchecked',
  anthropic: 'unchecked',
};

export const createSettingsSlice: StateCreator<SettingsSlice, [], [], SettingsSlice> = (set, get) => ({
  keys: emptyKeys,
  validations: emptyValidations,
  drawerOpen: false,
  validating: false,
  setKey: (provider, value) =>
    set((s) => ({
      keys: { ...s.keys, [provider]: value },
      validations: { ...s.validations, [provider]: 'unchecked' },
    })),
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  validateAll: async () => {
    const providers: Provider[] = ['fal', 'eleven', 'openai', 'anthropic'];
    set({
      validating: true,
      validations: providers.reduce<Validations>((acc, p) => {
        acc[p] = 'validating';
        return acc;
      }, { ...emptyValidations }),
    });
    const results = await llmService.validateAll(get().keys);
    set({
      validating: false,
      validations: {
        fal: results.fal.ok ? 'ok' : 'fail',
        eleven: results.eleven.ok ? 'ok' : 'fail',
        openai: results.openai.ok ? 'ok' : 'fail',
        anthropic: results.anthropic.ok ? 'ok' : 'fail',
      },
    });
  },
  clearKeys: () => set({ keys: emptyKeys, validations: emptyValidations }),
});
