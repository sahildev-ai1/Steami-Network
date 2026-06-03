import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Analytics } from "@vercel/analytics/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CursorEffect } from "@/components/CursorEffect";
import { ScrollToTop } from "@/components/ScrollToTop";
import { RelatedContentFloatingPanel } from "@/components/RelatedContentFloatingPanel";
import { OnboardingPopups } from '@/components/OnboardingPopups';

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
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} {...pageTransition} style={{ minHeight: '100vh' }}>
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
      {isContentRoute && <RelatedContentFloatingPanel />}
    </>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <CursorEffect />
      <BrowserRouter>
        <ScrollToTop />
        <AnimatedRoutes />
        <OnboardingPopups />
        <GlobalOverlays />
      </BrowserRouter>
      <Analytics />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
