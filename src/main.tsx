import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./theme.css";

const MapEmbed = lazy(() => import("./MapEmbed"));
const embedded = new URLSearchParams(window.location.search).get("embed") === "map";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {embedded ? <Suspense fallback={<div role="status">Загружаем карту…</div>}><MapEmbed /></Suspense> : <App />}
  </React.StrictMode>,
);
