import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startVersionCheck } from "./lib/versionCheck";

createRoot(document.getElementById("root")!).render(<App />);

// Cache-busting em runtime: detecta novas publicações e recarrega.
startVersionCheck();
