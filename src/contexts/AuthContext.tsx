import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { ensureUserVaultDefaults } from "@/lib/firestore";
import { queryKeys } from "@/lib/queryKeys";
import { auth } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  /** From ID token custom claim `catalogAdmin` (see `scripts/set-catalog-admin-claim.mjs`). */
  catalogAdmin: boolean;
  /** From ID token custom claim `recipeLibraryAdmin` (see `scripts/set-recipe-library-admin-claim.mjs`). */
  recipeLibraryAdmin: boolean;
  /** True until the first `getIdTokenResult` for the current user finishes. */
  claimsLoading: boolean;
  /** Forces a token refresh and re-reads custom claims (e.g. after `recipeLibraryAdmin` is granted). */
  refreshClaims: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogAdmin, setCatalogAdmin] = useState(false);
  const [recipeLibraryAdmin, setRecipeLibraryAdmin] = useState(false);
  const [claimsLoading, setClaimsLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setCatalogAdmin(false);
        setRecipeLibraryAdmin(false);
        setClaimsLoading(false);
        return;
      }
      setClaimsLoading(true);
      try {
        const r = await nextUser.getIdTokenResult();
        setCatalogAdmin(r.claims.catalogAdmin === true);
        setRecipeLibraryAdmin(r.claims.recipeLibraryAdmin === true);
      } catch {
        setCatalogAdmin(false);
        setRecipeLibraryAdmin(false);
      } finally {
        setClaimsLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const refreshClaims = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    setClaimsLoading(true);
    try {
      await u.getIdToken(true);
      const r = await u.getIdTokenResult();
      setCatalogAdmin(r.claims.catalogAdmin === true);
      setRecipeLibraryAdmin(r.claims.recipeLibraryAdmin === true);
    } catch {
      setCatalogAdmin(false);
      setRecipeLibraryAdmin(false);
    } finally {
      setClaimsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void ensureUserVaultDefaults()
      .then((seeded) => {
        if (cancelled || !seeded) return;
        queryClient.invalidateQueries({ queryKey: queryKeys.tags(user.uid) });
        queryClient.invalidateQueries({ queryKey: queryKeys.categories(user.uid) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, queryClient]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user,
      loading,
      catalogAdmin,
      recipeLibraryAdmin,
      claimsLoading,
      refreshClaims,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      sendPasswordReset,
      signOut,
    }),
    [
      user,
      loading,
      catalogAdmin,
      recipeLibraryAdmin,
      claimsLoading,
      refreshClaims,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      sendPasswordReset,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
