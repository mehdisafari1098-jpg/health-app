import React from "react";
import ReactDOM from "react-dom/client";
import HealthTracker from "./HealthTracker.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HealthTracker />
  </React.StrictMode>
);

// ثبت Service Worker برای کار آفلاین
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
