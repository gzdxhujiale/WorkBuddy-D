import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { TodayPage } from "@/pages/TodayPage";
import { FourQuadrantsPage } from "@/pages/FourQuadrantsPage";
import { HabitPage } from "@/pages/HabitPage";
import { DailyReviewPage } from "@/pages/DailyReviewPage";
import { KnowledgePage } from "@/pages/KnowledgePage";
import { ProjectsPage } from "@/pages/ProjectsPage";

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
  component: KnowledgePage,
});

export interface ProjectsSearch {
  view?: "kanban" | "gantt" | "table";
  status?: "all" | "in_progress" | "completed" | "archived";
  projectId?: string;
}

export const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects",
  validateSearch: (search: Record<string, unknown>): ProjectsSearch => ({
    view: (["kanban", "gantt", "table"].includes(search.view as string)
      ? search.view
      : undefined) as ProjectsSearch["view"],
    status: (["all", "in_progress", "completed", "archived"].includes(search.status as string)
      ? search.status
      : undefined) as ProjectsSearch["status"],
    projectId: typeof search.projectId === "string" ? search.projectId : undefined,
  }),
  component: ProjectsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  fourQuadrantsRoute,
  habitRoute,
  dailyReviewRoute,
  listsRoute,
  projectsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadDelay: 50,
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
