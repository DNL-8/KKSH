import { BrowserRouter } from "react-router-dom";

import { ToastProvider } from "./components/common/Toast";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { initWebVitals } from "./lib/webVitals";
import { AppRouter } from "./router";

// Start collecting Web Vitals metrics (CLS, INP, LCP)
initWebVitals();

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}