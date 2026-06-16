import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [user, setUser] = useState(null);
  const [shouldRefreshSession, setShouldRefreshSession] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("http://localhost:65000/api/auth/session", {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.role) {
          setUserRole(data.role);
          setUserEmail(data.email);
          setUser(data);
        } else {
          setUserRole(null);
          setUserEmail(null);
          setUser(null);
        }
      } catch (err) {
        console.error("Session check failed:", err);
        setUserRole(null);
        setUserEmail(null);
        setUser(null);
      }
    };

    fetchSession();
  }, [shouldRefreshSession]); // Add dependency to trigger refresh

  const triggerSessionRefresh = () => {
    setShouldRefreshSession(prev => !prev); // Toggle to trigger useEffect
  };

  const logout = async () => {
    try {
      await fetch("http://localhost:65000/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setUserRole(null);
      setUserEmail(null);
      setUser(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      userRole, 
      userEmail, 
      user, 
      setUserRole, 
      setUserEmail, 
      logout,
      triggerSessionRefresh 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);