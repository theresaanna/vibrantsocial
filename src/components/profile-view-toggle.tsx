import { FeedViewToggle, type FeedView } from "./feed-view-toggle";

interface ProfileViewToggleProps {
  username: string;
  activeView: FeedView;
}

export function ProfileViewToggle({ username, activeView }: ProfileViewToggleProps) {
  return (
    <FeedViewToggle
      activeView={activeView}
      postsHref={`/${username}`}
      mediaHref={`/${username}?view=media`}
    />
  );
}
