import { FeedViewToggle, type FeedView } from "./feed-view-toggle";

interface FeedViewToggleWrapperProps {
  activeView: FeedView;
}

export function FeedViewToggleWrapper({ activeView }: FeedViewToggleWrapperProps) {
  return (
    <FeedViewToggle
      activeView={activeView}
      postsHref="/feed"
      mediaHref="/feed?view=media"
    />
  );
}
