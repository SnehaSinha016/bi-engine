import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Sidebar from "./components/Sidebar";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import KpiStory from "./pages/KpiStory";
import DriverTree from "./pages/DriverTree";
import EvidenceExplorer from "./pages/EvidenceExplorer";
import ActionCenter from "./pages/ActionCenter";
import HistoricalMemory from "./pages/HistoricalMemory";
import SparseProduct from "./pages/SparseProduct";
import Feedback from "./pages/Feedback";
import Telemetry from "./pages/Telemetry";
import Reconciliation from "./pages/Reconciliation";
import DriverTreeAdmin from "./pages/DriverTreeAdmin";
import InvestigationView from "./pages/InvestigationView";
import DataManagement from "./pages/DataManagement";

function Shell() {
  const { user } = useAuth();

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7fb] text-slate-900">

      {/* -------------------------------------------------
          SIDEBAR
      -------------------------------------------------- */}
      <aside className="relative z-30 shrink-0">
        <Sidebar />
      </aside>

      {/* -------------------------------------------------
          MAIN APPLICATION AREA
      -------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* subtle top bar */}
        <header className="flex h-14 shrink-0 items-center justify-end border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md">

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-xs font-semibold text-slate-700">
                {user.name || user.title || "User"}
              </div>

              <div className="text-[10px] uppercase tracking-wide text-slate-400">
                {user.role || "User"}
              </div>
            </div>

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff] text-xs font-bold text-[#3157e8]">
              {(user.name || user.title || "U")
                .charAt(0)
                .toUpperCase()}
            </div>
          </div>
        </header>

        {/* -------------------------------------------------
            PAGE CONTENT
        -------------------------------------------------- */}
        <main className="min-w-0 flex-1 overflow-y-auto">

          <div className="min-h-full px-5 py-6 sm:px-7 lg:px-10 lg:py-8">

            <Routes>

              <Route
                path="/"
                element={<Dashboard />}
              />

              <Route
                path="/investigate/:kpiId"
                element={<InvestigationView />}
              />

              <Route
                path="/story/:kpiId"
                element={<KpiStory />}
              />

              <Route
                path="/tree"
                element={<DriverTree />}
              />

              <Route
                path="/evidence"
                element={<EvidenceExplorer />}
              />

              <Route
                path="/actions"
                element={<ActionCenter />}
              />

              <Route
                path="/memory"
                element={<HistoricalMemory />}
              />

              <Route
                path="/sparse"
                element={<SparseProduct />}
              />

              <Route
                path="/feedback"
                element={<Feedback />}
              />

              <Route
                path="/telemetry"
                element={<Telemetry />}
              />

              <Route
                path="/reconciliation"
                element={<Reconciliation />}
              />

              <Route
                path="/admin/driver-trees"
                element={<DriverTreeAdmin />}
              />

              <Route
                path="/data-management"
                element={<DataManagement />}
              />

              <Route
                path="*"
                element={<Navigate to="/" replace />}
              />

            </Routes>

          </div>

        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  );
}