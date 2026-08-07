import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { TodayPage } from "@/pages/TodayPage";
import { FourQuadrantsPage } from "@/pages/FourQuadrantsPage";
import { DailyReviewPage } from "@/pages/DailyReviewPage";
import { HabitPage } from "@/pages/HabitPage";
import { ListsPage } from "@/pages/ListsPage";

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

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
