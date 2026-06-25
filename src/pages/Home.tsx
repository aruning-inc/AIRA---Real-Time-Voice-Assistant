import { Face } from "../components/Face";
import { StatusIndicator } from "../components/StatusIndicator";
import { useAira } from "../hooks/useAira";
import { AssistantState } from "../core/StateManager";
import { Mic, MicOff } from "lucide-react";
import { motion } from "motion/react";

export function Home() {
  const { connect, disconnect, state } = useAira();

  const isDisconnected = state === AssistantState.DISCONNECTED;

  const toggleConnection = async () => {
    if (isDisconnected) {
      try {
        await connect();
      } catch (e) {
        console.error("Connection failed", e);
      }
    } else {
      disconnect();
    }
  };

  return (
    <div className="relative w-full h-[100dvh] bg-black overflow-hidden flex flex-col items-center justify-center font-sans">
      <div className="flex-1 flex items-center justify-center">
        <Face />
      </div>

      <div className="absolute bottom-12 flex flex-col items-center gap-6">
        <StatusIndicator />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleConnection}
          className={`w-16 h-16 flex items-center justify-center rounded-full transition-colors ${
            isDisconnected
              ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
              : "bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30"
          }`}
        >
          {isDisconnected ? <Mic size={24} /> : <MicOff size={24} />}
        </motion.button>
      </div>
    </div>
  );
}
