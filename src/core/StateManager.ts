import { create } from "zustand";

export enum AssistantState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  LISTENING = "listening",
  SPEAKING = "speaking",
}

interface AssistantStore {
  state: AssistantState;
  setState: (state: AssistantState) => void;
  volume: number; // Volume used for mouth animation
  setVolume: (volume: number) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useAssistantStore = create<AssistantStore>((set) => ({
  state: AssistantState.DISCONNECTED,
  setState: (state) => set({ state }),
  volume: 0,
  setVolume: (volume) => set({ volume }),
  error: null,
  setError: (error) => set({ error }),
}));
