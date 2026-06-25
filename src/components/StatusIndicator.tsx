import { AssistantState, useAssistantStore } from "../core/StateManager";
import { motion, AnimatePresence } from "motion/react";

export function StatusIndicator() {
  const state = useAssistantStore((s) => s.state);
  const error = useAssistantStore((s) => s.error);

  const getLabel = () => {
    if (error) {
      return error;
    }
    switch (state) {
      case AssistantState.CONNECTING:
        return "Connecting...";
      case AssistantState.LISTENING:
        return "Listening";
      case AssistantState.SPEAKING:
        return "Speaking";
      case AssistantState.DISCONNECTED:
      default:
        return "Disconnected";
    }
  };

  return (
    <div className="flex justify-center max-w-md mx-auto px-4 text-center">
      <motion.div
        layout
        className={`px-6 py-2 rounded-full backdrop-blur-md shadow-lg ${
          error ? "bg-red-500/20 border border-red-500/50" : "bg-white/10 border border-white/20"
        }`}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={error ? "error" : state}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`text-sm font-medium tracking-wide ${
              error ? "text-red-400" : "text-white/80 uppercase"
            }`}
          >
            {getLabel()}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
