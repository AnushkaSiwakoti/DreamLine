import axios from "axios";

const rawBase = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const BASE_URL = rawBase.replace(/\/+$/, "");

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

// Attach token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If auth fails, clear token
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem("token");
    }
    return Promise.reject(err);
  }
);
