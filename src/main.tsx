import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./i18n";
import "./index.css";
import { registerExportNotificationServiceWorker } from "./lib/register-export-notification-sw";

if (import.meta.env.PROD) {
  void registerExportNotificationServiceWorker();
}

createRoot(document.getElementById("root")!).render(<App />);
