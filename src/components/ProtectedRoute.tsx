import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-400 via-purple-400 to-blue-500 flex items-center justify-center">
        <div role="status" aria-label="Loading your account" className="flex flex-col items-center gap-4 text-white">
          <div className="loading-spinner h-11 w-11 rounded-full border-[3px] border-white/35 border-t-white shadow-lg shadow-blue-950/10"></div>
          <span className="text-sm font-medium tracking-wide">Getting things ready…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="page-enter bg-gradient-to-br from-teal-400 via-purple-400 to-blue-500 animate-gradient-xy animate-gradient-xy bg-200">
      {children}
    </div>
  );
}
