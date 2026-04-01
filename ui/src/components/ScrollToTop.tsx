import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Scroll window to top
    window.scrollTo({ top: 0, behavior: "instant" });
    // Also scroll any overflow container (for sidebar layouts)
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return null;
}
