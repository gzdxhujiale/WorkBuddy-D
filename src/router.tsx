import { lazy } from "react";
import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

const TodayPage = lazy(() => import("@/pages/TodayPage").then(m => ({ default: m.TodayPage })));
const FourQuadrantsPage = lazy(() => import("@/pages/FourQuadrantsPage").then(m => ({ default: m.FourQuadrantsPage })));
const HabitPage = lazy(() => import("@/pages/HabitPage").then(m => ({ default: m.HabitPage })));
const DailyReviewPage = lazy(() => import("@/pages/DailyReviewPage").then(m => ({ default: m.DailyReviewPage })));
const ListsPage = lazy(() => import("@/pages/ListsPage").then(m => ({ default: m.ListsPage })));

const rootRoute = createRootRoute({
  component: AppLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/today", replace: true });
  },
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/today",
  component: TodayPage,
});

const fourQuadrantsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/four-quadrants",
  component: FourQuadrantsPage,
});

const habitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/habit",
  component: HabitPage,
});

const dailyReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/daily-review",
  component: DailyReviewPage,
});

const listsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lists",
  component: ListsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  fourQuadrantsRoute,
  habitRoute,
  dailyReviewRoute,
  listsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => (
    <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">
      页面未找到
    </div>
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
