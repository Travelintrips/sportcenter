import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { TempoDevtools } from "tempo-devtools";
import { BrowserRouter } from "react-router-dom";

// Initialize Tempo Devtools
TempoDevtools.init();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
