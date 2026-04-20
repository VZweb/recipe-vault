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
  /** True until the first `getIdTokenResult` for the current user finishes. */
  claimsLoading: boolean;
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
  const [claimsLoading, setClaimsLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setCatalogAdmin(false);
      setClaimsLoading(false);
      return;
    }
    let cancelled = false;
    setClaimsLoading(true);
    void user
      .getIdToken(true)
      .then(() => user.getIdTokenResult())
      .then((r) => {
        if (cancelled) return;
        setCatalogAdmin(r.claims.catalogAdmin === true);
        setClaimsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

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
      claimsLoading,
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
      claimsLoading,
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
