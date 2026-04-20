import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ChefHat } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function mapAuthError(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function LoginPage() {
  const { user, loading, signInWithEmail, signInWithGoogle, sendPasswordReset } =
    useAuth();
  const location = useLocation();
  const state = location.state as { from?: string } | undefined;
  const from =
    state?.from && state.from !== "/login" ? state.from : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      setError(mapAuthError(code));
    } finally {
      setPending(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setPending(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      setError(mapAuthError(code));
    } finally {
      setPending(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError("Enter your email above, then click reset password.");
      return;
    }
    setError(null);
    setResetSent(false);
    setPending(true);
    try {
      await sendPasswordReset(email);
      setResetSent(true);
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      setError(mapAuthError(code));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-0px)] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
          <ChefHat size={28} />
        </div>
        <h1 className="font-heading text-2xl font-bold text-stone-900">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Recipe Vault — your collection, your account.
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {resetSent && (
            <p className="text-sm text-brand-700">
              Check your inbox for a reset link.
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            Sign in
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            className="text-brand-700 hover:underline"
            onClick={handleReset}
            disabled={pending}
          >
            Forgot password?
          </button>
          <Link to="/register" className="text-stone-600 hover:text-stone-900">
            Create account
          </Link>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-stone-400">or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={handleGoogle}
          disabled={pending}
        >
          Continue with Google
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-stone-500">
        By signing in you agree to use this app only for your personal data.
      </p>
    </div>
  );
}
