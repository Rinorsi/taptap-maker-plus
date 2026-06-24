import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "./app/AppShell";
import { AppToaster } from "./components/ui/AppToaster";
import { queryClient } from "./queries";
import { installDeveloperDiagnostics } from "./lib/developerMode";
import "./styles.css";

installDeveloperDiagnostics();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppShell />
      <AppToaster />
    </QueryClientProvider>
  </React.StrictMode>
);
