import axios from "axios";
import { useAuthStore } from "@/store/auth";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const api = axios.create({ baseURL: `${baseURL}/api`, timeout: 20_000 });

api.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().token;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      useAuthStore.getState().logout();
      // Avoid loops in case we're already on /login.
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export const wsBaseUrl: string = import.meta.env.VITE_WS_URL ?? "ws://localhost:4000/ws";
