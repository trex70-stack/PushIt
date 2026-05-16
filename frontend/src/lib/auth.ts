import { api } from "./api.js";

export interface User {
  id: string;
  email: string;
  role: "admin" | "user";
}

export async function login(email: string, password: string): Promise<User> {
  const { data } = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
  localStorage.setItem("token", data.token);
  return data.user;
}

export function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}
