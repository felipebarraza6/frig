const TOKEN_KEY = "frig.token";
const BRANCH_KEY = "frig.branch_id";

export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  window.localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = (): void => {
  window.localStorage.removeItem(TOKEN_KEY);
};

export const getBranchId = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BRANCH_KEY);
};

export const setBranchId = (id: string | number): void => {
  window.localStorage.setItem(BRANCH_KEY, String(id));
};

export const clearBranchId = (): void => {
  window.localStorage.removeItem(BRANCH_KEY);
};