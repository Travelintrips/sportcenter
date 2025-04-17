import { useState } from "react";
import { BrowserRouter, Routes, Route, useRoutes } from "react-router-dom";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

// Import tempo routes
import routes from "tempo-routes";

function AppContent() {
  const [count, setCount] = useState(0);

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

function TempoRoutes() {
  // This component must be used inside a Router
  return import.meta.env.VITE_TEMPO ? useRoutes(routes) : null;
}

function App() {
  return (
    <BrowserRouter>
      {/* Tempo routes - only included in development */}
      <TempoRoutes />

      <Routes>
        <Route path="/" element={<AppContent />} />

        {/* Add this before any catchall route */}
        {import.meta.env.VITE_TEMPO && <Route path="/tempobook/*" />}

        {/* Add other routes here */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
