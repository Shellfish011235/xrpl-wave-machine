import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { installStorageGuard } from "./lib/storageGuard";
import "./index.css";

installStorageGuard();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("XRPL Wave Machine could not find the #root mount element.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
