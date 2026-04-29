import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"
import "./styles/index.css";
import { MyProfileProvider } from "./hooks/useMyProfile.js";


import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <MyProfileProvider>
        <App />
        <SpeedInsights />
        <Analytics/>
      </MyProfileProvider>
    </BrowserRouter>
  </StrictMode>
);
