import type { StateCreator } from 'zustand';
import type { Brief } from '../types';

export type BriefSlice = {
  brief: Brief;
  briefSubmitted: boolean;
  setBriefField: (field: keyof Brief, value: string) => void;
  submitBrief: () => boolean;
  resetBrief: () => void;
};

const emptyBrief: Brief = { productName: '', targetAudience: '', adAngle: '' };

function isComplete(b: Brief): boolean {
  return b.productName.trim().length > 0 && b.targetAudience.trim().length > 0 && b.adAngle.trim().length > 0;
}

export const createBriefSlice: StateCreator<BriefSlice, [], [], BriefSlice> = (set, get) => ({
  brief: emptyBrief,
  briefSubmitted: false,
  setBriefField: (field, value) =>
    set((s) => ({ brief: { ...s.brief, [field]: value } })),
  submitBrief: () => {
    if (!isComplete(get().brief)) return false;
    set({ briefSubmitted: true });
    return true;
  },
  resetBrief: () => set({ brief: emptyBrief, briefSubmitted: false }),
});
