export const paths = {
  home: {
    path: "/",
    getHref: () => "/",
  },
  today: {
    path: "/today",
    getHref: () => "/today",
  },
  fourQuadrants: {
    path: "/four-quadrants",
    getHref: () => "/four-quadrants",
  },
  projects: {
    path: "/projects",
    getHref: () => "/projects",
  },
  habit: {
    path: "/habit",
    getHref: () => "/habit",
  },
  knowledge: {
    path: "/lists",
    getHref: () => "/lists",
  },
  dailyReview: {
    path: "/daily-review",
    getHref: () => "/daily-review",
  },
} as const;

export type AppPath = typeof paths;
