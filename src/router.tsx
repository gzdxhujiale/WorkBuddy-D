import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { TodayPage } from "@/pages/TodayPage";
import { FourQuadrantsPage } from "@/pages/FourQuadrantsPage";
import { DailyReviewPage } from "@/pages/DailyReviewPage";
import { HabitPage } from "@/pages/HabitPage";

const rootRoute = createRootRoute({
  component: AppLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: TodayPage,
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

const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  fourQuadrantsRoute,
  habitRoute,
  dailyReviewRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
