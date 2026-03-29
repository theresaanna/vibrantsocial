"use client";

import { createContext, useContext } from "react";

interface PostContextValue {
  isPostAuthor: boolean;
  postId: string | null;
  currentUserId: string | null;
}

const PostAuthorContext = createContext<PostContextValue>({
  isPostAuthor: false,
  postId: null,
  currentUserId: null,
});

export function PostAuthorProvider({
  isPostAuthor,
  postId,
  currentUserId,
  children,
}: {
  isPostAuthor: boolean;
  postId?: string | null;
  currentUserId?: string | null;
  children: React.ReactNode;
}) {
  return (
    <PostAuthorContext.Provider
      value={{
        isPostAuthor,
        postId: postId ?? null,
        currentUserId: currentUserId ?? null,
      }}
    >
      {children}
    </PostAuthorContext.Provider>
  );
}

export function useIsPostAuthor(): boolean {
  return useContext(PostAuthorContext).isPostAuthor;
}

export function usePostContext(): PostContextValue {
  return useContext(PostAuthorContext);
}
