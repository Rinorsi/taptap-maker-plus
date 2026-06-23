import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { Command } from "./types";
import { createCommandRegistry, type CommandRegistry } from "./registry";

const CommandRegistryContext = createContext<CommandRegistry | undefined>(undefined);

type CommandProviderProps = {
  commands?: Command[];
  registry?: CommandRegistry;
  children: ReactNode;
};

export function CommandProvider({ commands = [], registry, children }: CommandProviderProps) {
  const createdRegistry = useMemo(() => registry ?? createCommandRegistry(commands), [commands, registry]);
  return (
    <CommandRegistryContext.Provider value={createdRegistry}>
      {children}
    </CommandRegistryContext.Provider>
  );
}

export function useCommandRegistry() {
  const registry = useContext(CommandRegistryContext);
  if (!registry) throw new Error("useCommandRegistry must be used inside CommandProvider");
  return registry;
}
