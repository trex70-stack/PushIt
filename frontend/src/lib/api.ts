import axios from "axios";

export const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data !== undefined && !config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json";
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?redirect=${redirect}`;
    }
    return Promise.reject(error);
  }
);
