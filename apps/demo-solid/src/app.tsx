import {
  createNativeScriptRouter,
  createRootRoute,
  createRoute,
  NativeScriptRouterProvider,
} from "@nativescript/tanstack-router/solid";
import Home from "./components/home";
import About from "./components/about";
import PostList from "./components/post-list";
import PostDetail from "./components/post-detail";
import UserModal from "./components/user-modal";
import "./global";

const USERS: Record<
  string,
  {
    id: string;
    name: string;
    role: string;
    avatarUrl: string;
    bio: string;
    location: string;
    followers: string;
  }
> = {
  "1": {
    id: "1",
    name: "Ted Milano",
    role: "Lead Designer",
    avatarUrl: "https://i.pravatar.cc/400?img=12",
    bio: "Designing native interfaces that feel premium and obvious to use.",
    location: "Berlin, Germany",
    followers: "18.4K",
  },
  "2": {
    id: "2",
    name: "Sonia Brooks",
    role: "Mobile Architect",
    avatarUrl: "https://i.pravatar.cc/400?img=32",
    bio: "Building high-performance app architecture with practical DX.",
    location: "Toronto, Canada",
    followers: "12.2K",
  },
  "3": {
    id: "3",
    name: "Avery Kim",
    role: "Developer Advocate",
    avatarUrl: "https://i.pravatar.cc/400?img=24",
    bio: "Helping teams ship modern mobile apps with confidence.",
    location: "Seattle, USA",
    followers: "25.1K",
  },
};

const POSTS: Array<{
  id: string;
  category: string;
  title: string;
  excerpt: string;
  body: string;
  coverUrl: string;
  likes: number;
  readSecondsAgo: string;
  readMinutes: string;
  authorId: string;
}> = [
  {
    id: "1",
    category: "Design",
    title: "How Work is Changing",
    excerpt:
      "A practical look at how design systems and AI tools are changing independent work.",
    body: "Freelance work is moving from one-off screens to full product thinking. Teams now expect fast iteration, predictable delivery, and native-level polish. With NativeScript and TanStack Router, independent developers can ship type-safe, production-ready flows without splitting teams by platform. The result is less glue code, stronger UX consistency, and more time spent on product value.",
    coverUrl: "https://picsum.photos/seed/ns-router-hero-1/1200/800",
    likes: 786,
    readSecondsAgo: "25 sec ago",
    readMinutes: "6 min read",
    authorId: "1",
  },
  {
    id: "2",
    category: "Tech",
    title: "Native Back Stack Meets Type-Safe URLs",
    excerpt:
      "How NativeScript Frame navigation and TanStack history can stay perfectly in sync.",
    body: "On mobile, users expect hardware back and gesture back to always work. TanStack Router expects deterministic history transitions. Bridging those worlds means syncing navigation intent in both directions while avoiding circular updates. This demo shows exactly that: router-driven forward transitions, native back gestures, and consistent route state across preserved pages in the stack.",
    coverUrl: "https://picsum.photos/seed/ns-router-hero-2/1200/800",
    likes: 512,
    readSecondsAgo: "1 min ago",
    readMinutes: "4 min read",
    authorId: "2",
  },
  {
    id: "3",
    category: "Engineering",
    title: "Shipping Modal Routes Without Breaking UX",
    excerpt:
      "Route-driven modal experiences that still feel native and predictable.",
    body: "Modal routes are powerful for profile cards, quick actions, and in-context details. In this implementation, a modal can open via search params and close while preserving route intent. That enables deep-link-friendly behavior without abandoning native platform conventions. It is a small pattern that dramatically improves product quality in real apps.",
    coverUrl: "https://picsum.photos/seed/ns-router-hero-3/1200/800",
    likes: 309,
    readSecondsAgo: "3 min ago",
    readMinutes: "5 min read",
    authorId: "3",
  },
];

// Define route tree
const rootRoute = createRootRoute();

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
  loader: async () => {
    const featured = POSTS[0];
    const popular = POSTS.slice(1);
    return {
      featured,
      popular,
      users: USERS,
    };
  },
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: About,
});

const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/posts",
  component: PostList,
  loader: async () => {
    return {
      posts: POSTS,
      users: USERS,
    };
  },
});

const postDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/posts/$postId",
  component: PostDetail,
  loader: async ({ params }) => {
    const index = POSTS.findIndex((post) => post.id === params.postId);
    const post =
      index >= 0
        ? POSTS[index]
        : {
            id: params.postId,
            category: "Unknown",
            title: "Post Not Found",
            excerpt: "The requested post could not be loaded.",
            body: "This post does not exist in the demo dataset.",
            coverUrl: "https://picsum.photos/seed/ns-router-fallback/1200/800",
            likes: 0,
            readSecondsAgo: "just now",
            readMinutes: "1 min read",
            authorId: "1",
          };

    const nextPost =
      POSTS[(index + 1 + POSTS.length) % POSTS.length] || POSTS[0];

    return {
      post,
      author: USERS[post.authorId] || USERS["1"],
      nextPostId: nextPost.id,
    };
  },
});

const userModalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users/$userId",
  component: UserModal,
  loader: async ({ params }) => {
    const user = USERS[params.userId] || {
      id: params.userId,
      name: `User ${params.userId}`,
      role: "Guest Contributor",
      avatarUrl: `https://i.pravatar.cc/400?u=guest-${params.userId}`,
      bio: "This profile was generated from a dynamic route parameter.",
      location: "Remote",
      followers: "1.2K",
    };

    return {
      user,
    };
  },
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  aboutRoute,
  postsRoute,
  postDetailRoute,
  userModalRoute,
]);

// Create router
const router = createNativeScriptRouter({
  routeTree,
  initialPath: "/",
});

// Type registration
declare module "@nativescript/tanstack-router/solid" {
  interface Register {
    router: typeof router;
  }
}

const App = () => {
  return (
    <NativeScriptRouterProvider
      router={router}
      debug={true}
      actionBarVisibility="never"
    />
  );
};

export { App };
