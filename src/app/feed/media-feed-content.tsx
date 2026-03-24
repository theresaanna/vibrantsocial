import { fetchMediaFeedPage } from "./media-actions";
import { MediaGrid } from "@/components/media-grid";

/**
 * Async server component that fetches initial media feed data.
 * Designed to be wrapped in <Suspense> so the page shell streams immediately.
 */
export async function MediaFeedContent() {
  const { posts, hasMore } = await fetchMediaFeedPage();

  return <MediaGrid initialPosts={posts} initialHasMore={hasMore} />;
}
