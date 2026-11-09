import { clerkMiddleware } from "@clerk/nextjs/server";

// Route protection lives with the resource: app/app/layout.tsx calls auth()
// before rendering, and every Convex function re-checks the viewer.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
