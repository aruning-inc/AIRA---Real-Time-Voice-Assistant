import { motion } from "motion/react";
import { AssistantState, useAssistantStore } from "../core/StateManager";

export function Eyes() {
  const state = useAssistantStore((s) => s.state);

  const getAnimation = () => {
    switch (state) {
      case AssistantState.CONNECTING:
        return {
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5],
          transition: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
        };
      case AssistantState.LISTENING:
        return {
          scale: [1, 1.05, 1],
          opacity: 1,
          transition: { repeat: Infinity, duration: 2, ease: "easeInOut" },
        };
      case AssistantState.SPEAKING:
        return {
          scale: [1, 1.15, 1],
          opacity: [0.8, 1, 0.8],
          transition: { repeat: Infinity, duration: 1, ease: "easeInOut" },
        };
      case AssistantState.DISCONNECTED:
      default:
        return { scale: 1, opacity: 0.3 };
    }
  };

  return (
    <div className="flex gap-8 justify-center items-center">
      <motion.div
        animate={getAnimation()}
        className="w-8 h-8 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)]"
      />
      <motion.div
        animate={getAnimation()}
        className="w-8 h-8 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)]"
      />
    </div>
  );
}
