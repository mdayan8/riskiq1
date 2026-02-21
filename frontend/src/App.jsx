import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UploadPage from "./pages/UploadPage";
import AlertsPage from "./pages/AlertsPage";
import DataSourcesPage from "./pages/DataSourcesPage";
import ReportsPage from "./pages/ReportsPage";
import ComplianceStorePage from "./pages/ComplianceStorePage";
import SessionsPage from "./pages/SessionsPage";
import SubmissionSimulationPage from "./pages/SubmissionSimulationPage";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("riskiq_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="sources" element={<DataSourcesPage />} />
        <Route path="compliance-store" element={<ComplianceStorePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="submission-simulations" element={<SubmissionSimulationPage />} />
      </Route>
    </Routes>
  );
}
