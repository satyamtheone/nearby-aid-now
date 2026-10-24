import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-teal-400 via-purple-400 to-blue-500 px-4 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>
        <Link to="/" className="text-white underline underline-offset-4 hover:text-blue-100">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
