import { Navigate, Route, Routes } from "react-router-dom";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import Dashboard from "@/pages/Dashboard";
import StockDetail from "@/pages/StockDetail";
import MFDetail from "@/pages/MFDetail";
import Portfolio from "@/pages/Portfolio";
import Watchlist from "@/pages/Watchlist";
import Screener from "@/pages/Screener";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import MFCompare from "@/pages/MFCompare";
import Alerts from "@/pages/Alerts";
import Education from "@/pages/Education";
import StockSearch from "@/pages/StockSearch";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stocks/add" element={<StockSearch />} />
          <Route path="/stocks/:symbol" element={<StockDetail />} />
          <Route path="/mf/compare" element={<MFCompare />} />
          <Route path="/mf/:id" element={<MFDetail />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/learn" element={<Education />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
