import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster, toast } from "sonner";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Dump from "./pages/Dump";
import Plan from "./pages/Plan";
import Progress from "./pages/Progress";
import Navigation from "./components/Navigation";

import { api } from "./api";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) fetchCurrentUser();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch (err) {
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = (token, userData) => {
    localStorage.setItem("token", token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    toast.success("Logged out successfully");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#FDFBF7" }}>
        <div className="text-sage-600 text-lg font-body">Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#FDFBF7", minHeight: "100vh" }}>
      <BrowserRouter>
        {user && <Navigation onLogout={handleLogout} />}

        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Landing />} />
          <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <Auth onAuth={handleAuth} />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
          <Route path="/dump" element={user ? <Dump /> : <Navigate to="/" />} />
          <Route path="/plan" element={user ? <Plan /> : <Navigate to="/" />} />
          <Route path="/progress" element={user ? <Progress /> : <Navigate to="/" />} />
        </Routes>
      </BrowserRouter>

      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;
