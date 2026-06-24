import type { AppCommandContext } from "./types";

export const COMMAND_RUN_EVENT = "taptap:command-run";

export type CommandRunRequest = {
  commandId: string;
  context?: AppCommandContext;
};

export function requestCommandRun(commandId: string, context?: AppCommandContext) {
  window.dispatchEvent(
    new CustomEvent<CommandRunRequest>(COMMAND_RUN_EVENT, {
      detail: { commandId, context },
    }),
  );
}
