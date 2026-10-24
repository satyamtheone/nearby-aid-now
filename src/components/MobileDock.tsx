import { motion } from "framer-motion";
import { House, MessageCircle, Plus, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const destinations = [
  { path: "/", label: "Home", icon: House },
  { path: "/chat", label: "Community", icon: MessageCircle },
  { path: "/ask-help", label: "Ask", icon: Plus, primary: true },
  { path: "/profile", label: "Profile", icon: UserRound },
];

export function MobileDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const visibleOn = ["/", "/ask-help", "/profile"];
  if (!visibleOn.includes(location.pathname)) return null;

  return (
    <nav aria-label="Main navigation" className="mobile-dock md:hidden">
      {destinations.map(({ path, label, icon: Icon, primary }) => {
        const active = location.pathname === path;
        return (
          <motion.button
            key={path}
            type="button"
            whileTap={{ scale: 0.92 }}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            onClick={() => navigate(path)}
            className={`mobile-dock-item ${primary ? "mobile-dock-primary" : ""} ${active ? "is-active" : ""}`}
          >
            <Icon className={primary ? "h-5 w-5" : "h-[18px] w-[18px]"} strokeWidth={primary ? 2.5 : 2} />
            <span>{label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
}
