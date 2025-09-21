import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // try a page-specific anchor first
    const topAnchor = document.querySelector('[data-scroll-top]') as HTMLElement | null;
    if (topAnchor) topAnchor.scrollIntoView({ behavior: "instant", block: "start" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}
