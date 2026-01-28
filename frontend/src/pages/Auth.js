import React, { useState } from "react";
import { toast } from "sonner";
import { Mail, Lock } from "lucide-react";
import { api } from "../api";

export default function Auth({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/signup";
      const response = await api.post(endpoint, { email, password });

      onAuth(response.data.token, response.data.user);
      toast.success(isLogin ? "Welcome back!" : "Account created successfully!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: "#FDFBF7" }}>
      <div className="w-full max-w-md">
        <div className="glass rounded-[2rem] p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-heading font-semibold text-foreground">
              {isLogin ? "Welcome back" : "Get started"}
            </h2>
            <p className="text-base text-sage-700 font-body">
              {isLogin ? "Sign in to continue your journey" : "Create your account"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="auth-form">
            <div className="space-y-2">
              <label className="text-sm font-medium text-sage-800 font-body block">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="email-input"
                  className="w-full pl-12 pr-6 py-4 rounded-2xl text-lg font-body focus:outline-none focus:ring-4 transition-all"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.5)",
                    border: "none",
                    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.06)",
                    color: "#2D3748",
                  }}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-sage-800 font-body block">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="password-input"
                  className="w-full pl-12 pr-6 py-4 rounded-2xl text-lg font-body focus:outline-none focus:ring-4 transition-all"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.5)",
                    border: "none",
                    boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.06)",
                    color: "#2D3748",
                  }}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              data-testid="auth-submit-btn"
              className="w-full px-8 py-4 text-lg font-medium text-white rounded-full shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "#7E9C8F",
                boxShadow: "0 4px 14px 0 rgba(126, 156, 143, 0.39)",
              }}
            >
              {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              data-testid="toggle-auth-mode"
              className="text-sage-700 hover:text-sage-900 text-sm font-body transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
