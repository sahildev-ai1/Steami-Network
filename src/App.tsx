import { lazy, Suspense, useRef, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Analytics } from "@vercel/analytics/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollToTop } from "@/components/ScrollToTop";

// ─── Lazy-loaded non-critical overlays ────────────────────────────────────────
// PERFORMANCE FIX: these were imported eagerly, so their code shipped inside
// the main entry chunk and executed on every single page load — including
// the very first paint — even though none of them are actual page content:
// a custom cursor, an onboarding tour, and a panel that only ever renders on
// a small subset of routes (and previously loaded its code unconditionally
// regardless). Lazy-loading keeps all three off the critical path.
const CursorEffect = lazy(() =>
  import("@/components/CursorEffect").then((m) => ({ default: m.CursorEffect }))
);
const OnboardingPopups = lazy(() =>
  import("@/components/OnboardingPopups").then((m) => ({ default: m.OnboardingPopups }))
);
const RelatedContentFloatingPanel = lazy(() =>
  import("@/components/RelatedContentFloatingPanel").then((m) => ({ default: m.RelatedContentFloatingPanel }))
);

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
// Each page becomes its own JS chunk — only downloaded when the user visits it.
const HomePage          = lazy(() => import("./pages/HomePage"));
const ExplainerPage     = lazy(() => import("./pages/ExplainerPage"));
const ExplorePage       = lazy(() => import("./pages/ExplorePage"));
const ResearchPage      = lazy(() => import("./pages/ResearchPage"));
const SimulationsPage   = lazy(() => import("./pages/SimulationsPage"));
const BlogListingPage   = lazy(() => import("./pages/BlogListingPage"));
const BlogArticlePage   = lazy(() => import("./pages/BlogArticlePage"));
const DashboardPage     = lazy(() => import("./pages/DashboardPage"));
const ProfilePage       = lazy(() => import("./pages/ProfilePage"));
const InsightsPage      = lazy(() => import("./pages/InsightsPage"));
const InterestsPage     = lazy(() => import("./pages/InterestsPage"));
const AdminPage         = lazy(() => import("./pages/AdminPage"));
const ModerationPage    = lazy(() => import("./pages/ModerationPage"));
const ApiConsolePage    = lazy(() => import("./pages/ApiConsolePage"));
const ChatPage          = lazy(() => import("./pages/ChatPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const NotFound          = lazy(() => import("./pages/NotFound"));

// ─── Page loading fallback ────────────────────────────────────────────────────
const PageSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-steami-cyan/30 border-t-steami-cyan animate-spin" />
  </div>
);

// ─── Query client ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient();

// ─── Page transition config ───────────────────────────────────────────────────
const pageTransition = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
};

// ─── Animated routes ──────────────────────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation();

  /**
   * PERFORMANCE FIX (Lighthouse LCP: 7.7s):
   * Every route mount — including the very first page load — faded in from
   * opacity:0/scale:0.98 over 300ms via Framer Motion. That's a nice touch
   * for in-app navigation, but on the initial load it directly delays when
   * the largest contentful element becomes fully visible, which is exactly
   * what LCP measures. Skip the enter animation for the first render only;
   * every subsequent route change still gets the normal transition.
   */
  const isFirstRender = useRef(true);
  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={isFirstRender.current ? false : pageTransition.initial}
        animate={pageTransition.animate}
        exit={pageTransition.exit}
        transition={pageTransition.transition}
        style={{ minHeight: '100vh' }}
      >
        {/* Suspense here so each lazy page shows the spinner while its chunk loads */}
        <Suspense fallback={<PageSkeleton />}>
          <Routes location={location}>
            <Route path="/"            element={<HomePage />} />
            <Route path="/explainers"  element={<ExplainerPage />} />
            <Route path="/explore"     element={<ExplorePage />} />
            <Route path="/blog"        element={<BlogListingPage />} />
            <Route path="/blog/:id"    element={<BlogArticlePage />} />
            <Route path="/research"    element={<ResearchPage />} />
            <Route path="/simulations" element={<SimulationsPage />} />
            <Route path="/dashboard"   element={<DashboardPage />} />
            <Route path="/profile"     element={<ProfilePage />} />
            <Route path="/interests"   element={<InterestsPage />} />
            <Route path="/insights"    element={<InsightsPage />} />
            <Route path="/admin"       element={<AdminPage />} />
            <Route path="/moderation"  element={<ModerationPage />} />
            <Route path="/api-console" element={<ApiConsolePage />} />
            <Route path="/chat"        element={<ChatPage />} />
            <Route path="/privacy"     element={<PrivacyPolicyPage />} />
            <Route path="*"            element={<NotFound />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Global overlays ─────────────────────────────────────────────────────────
/**
 * GlobalOverlays — mounted inside BrowserRouter so it can read the URL.
 * Shows RelatedContentFloatingPanel when a content URL param is active,
 * which automatically suppresses the news popup on those routes.
 */
function GlobalOverlays() {
  const location = useLocation();
  const [params] = useSearchParams();

  const hasExplainer = !!params.get('explainer');
  const hasResearch  = !!params.get('research');
  const hasBlog      = /^\/blog\/.+/.test(location.pathname);

  const isContentRoute = hasExplainer || hasResearch || hasBlog;

  return (
    <>
      {isContentRoute && (
        <Suspense fallback={null}>
          <RelatedContentFloatingPanel />
        </Suspense>
      )}
    </>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Suspense fallback={null}>
        <CursorEffect />
      </Suspense>
      <BrowserRouter>
        <ScrollToTop />
        <AnimatedRoutes />
        <Suspense fallback={null}>
          <OnboardingPopups />
        </Suspense>
        <GlobalOverlays />
      </BrowserRouter>
      <Analytics />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
