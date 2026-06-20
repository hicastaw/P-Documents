import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "./auth-context";

/**
 * Redirect về /login nếu chưa authenticated.
 * Trả về { user } khi đã auth, null khi đang loading.
 */
export function useRequireAuth() {
  const { authState } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authState.status === "unauthenticated") {
      router.replace("/login");
    }
  }, [authState.status, router]);

  if (authState.status === "authenticated") {
    return authState.user;
  }
  return null;
}
