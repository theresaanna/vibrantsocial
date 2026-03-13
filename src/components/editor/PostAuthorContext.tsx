"use client";

import { createContext, useContext } from "react";

const PostAuthorContext = createContext(false);

export function PostAuthorProvider({
  isPostAuthor,
  children,
}: {
  isPostAuthor: boolean;
  children: React.ReactNode;
}) {
  return (
    <PostAuthorContext.Provider value={isPostAuthor}>
      {children}
    </PostAuthorContext.Provider>
  );
}

export function useIsPostAuthor(): boolean {
  return useContext(PostAuthorContext);
}
