"use client";

import { createContext, useContext } from "react";

export const AblyReadyContext = createContext(false);

export function useAblyReady() {
  return useContext(AblyReadyContext);
}
