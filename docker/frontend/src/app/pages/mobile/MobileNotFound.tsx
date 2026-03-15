import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const MobileNotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error (mobile):", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground px-5 py-12 flex flex-col items-center justify-center text-center">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Error</p>
      <h1 className="text-5xl font-bold mt-2">404</h1>
      <p className="mt-3 text-sm text-muted-foreground">This page does not exist on the current route.</p>
      <Link to="/" className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
        Back to Login
      </Link>
    </div>
  );
};

export default MobileNotFound;
