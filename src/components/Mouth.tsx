import { motion } from "motion/react";
import { AssistantState, useAssistantStore } from "../core/StateManager";

export function Mouth() {
  const state = useAssistantStore((s) => s.state);
  const volume = useAssistantStore((s) => s.volume);

  const getWidth = () => {
    switch (state) {
      case AssistantState.SPEAKING:
        // Base width 40, expand up to 120 based on volume
        return 40 + volume * 100;
      case AssistantState.LISTENING:
        return 48;
      case AssistantState.CONNECTING:
        return 32;
      case AssistantState.DISCONNECTED:
      default:
        return 40;
    }
  };

  const getHeight = () => {
    switch (state) {
      case AssistantState.SPEAKING:
        // Base height 8, expand up to 64 based on volume
        return 8 + volume * 64;
      case AssistantState.LISTENING:
        return 12;
      case AssistantState.CONNECTING:
        return 8;
      case AssistantState.DISCONNECTED:
      default:
        return 4;
    }
  };

  return (
    <div className="flex justify-center items-center h-16 mt-8">
      <motion.div
        animate={{
          width: getWidth(),
          height: getHeight(),
          opacity: state === AssistantState.DISCONNECTED ? 0.3 : 0.8,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.6)]"
      />
    </div>
  );
}
