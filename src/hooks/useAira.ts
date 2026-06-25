import { useEffect, useRef } from "react";
import { LiveSession } from "../core/LiveSession";
import { useAssistantStore } from "../core/StateManager";

export function useAira() {
  const sessionRef = useRef<LiveSession | null>(null);
  const state = useAssistantStore((s) => s.state);

  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.disconnect();
        sessionRef.current = null;
      }
    };
  }, []);

  const connect = async () => {
    const setError = useAssistantStore.getState().setError;
    try {
      if (!sessionRef.current) {
        sessionRef.current = new LiveSession();
      }
      await sessionRef.current.connect();
    } catch (e: any) {
      console.error("Connection failed:", e);
      setError(e.message || "Failed to initialize connection.");
    }
  };

  const disconnect = () => {
    if (sessionRef.current) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
    }
  };

  return { connect, disconnect, state };
}
