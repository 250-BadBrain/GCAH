import { createRoot } from "react-dom/client";

import { DemoApp } from "./demo-app.js";
import "./styles.css";

const root = document.getElementById("root");

if (root !== null) {
  createRoot(root).render(<DemoApp />);
}
