import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/App";
import "@/index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error(
    "The control center could not start because its mount point is missing. " +
      "Reinstall the plugin, then run `superdev start --apply` again.",
  );
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
