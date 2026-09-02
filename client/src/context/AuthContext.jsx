import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [session, setSession] = useState(() => {
    const raw = sessionStorage.getItem("bi_session");
    return raw ? JSON.parse(raw) : null;
  });
  const [region, setRegion] = useState(() => sessionStorage.getItem("bi_region") || "all");
  // "demo" (default, existing behavior) | "userdata" | "combined" ,
  // see server/middleware/dataMode.js. Read by api.js's request()
  // wrapper and sent as X-Data-Mode on every authenticated call.
  const [dataMode, setDataMode] = useState(() => sessionStorage.getItem("bi_data_mode") || "demo");

  useEffect(() => {
    api.listUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (session) sessionStorage.setItem("bi_session", JSON.stringify(session));
    else sessionStorage.removeItem("bi_session");
  }, [session]);

  useEffect(() => {
    sessionStorage.setItem("bi_region", region);
  }, [region]);

  useEffect(() => {
    sessionStorage.setItem("bi_data_mode", dataMode);
  }, [dataMode]);

  const login = useCallback(async (userId) => {
    const data = await api.login(userId);
    setSession(data);
    setRegion(data.user.regionScope === "all" ? "all" : data.user.regionScope);
    return data;
  }, []);

  const logout = useCallback(() => setSession(null), []);

  return (
    <AuthContext.Provider value={{ users, session, token: session?.token, user: session?.user, login, logout, region, setRegion, dataMode, setDataMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
