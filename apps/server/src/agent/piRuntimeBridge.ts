export type PiAgentRuntimeStatus = {
  connected: boolean;
  integrationMode: "not_connected" | "sdk" | "rpc";
  packageName: "@earendil-works/pi-coding-agent";
  sdkPreferred: boolean;
  rpcFallbackAvailable: boolean;
  lastError?: string;
};

export function getPiAgentRuntimeStatus(): PiAgentRuntimeStatus {
  return {
    connected: false,
    integrationMode: "not_connected",
    packageName: "@earendil-works/pi-coding-agent",
    sdkPreferred: true,
    rpcFallbackAvailable: true,
  };
}
