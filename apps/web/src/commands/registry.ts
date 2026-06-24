import type { AppCommandContext, Command } from "./types";

export function createCommandRegistry(commands: Command[]) {
  const byId = new Map<string, Command>();

  for (const command of commands) {
    if (byId.has(command.commandId)) {
      throw new Error(`Duplicate commandId: ${command.commandId}`);
    }
    byId.set(command.commandId, command);
  }

  return {
    commands,
    get(commandId: string) {
      return byId.get(commandId);
    },
    list(context: AppCommandContext) {
      return commands.filter((command) => isCommandAvailable(command, context));
    },
    run(commandId: string, context: AppCommandContext) {
      const command = byId.get(commandId);
      if (!command || !isCommandAvailable(command, context)) return undefined;
      return command.run(context);
    },
  };
}

export type CommandRegistry = ReturnType<typeof createCommandRegistry>;

export function isCommandAvailable(
  command: Command,
  context: AppCommandContext,
) {
  if (!scopeMatches(command.scope, context.objectType)) return false;
  return command.when ? command.when(context) : true;
}

function scopeMatches(
  scope: Command["scope"],
  objectType: AppCommandContext["objectType"],
) {
  if (Array.isArray(scope)) return scope.includes(objectType);
  return scope === "global" || scope === objectType;
}
