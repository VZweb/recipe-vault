import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ChefHat } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function mapAuthError(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account already exists with this email.";
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function RegisterPage() {
  const { user, loading, signUpWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setPending(true);
    try {
      await signUpWithEmail(email, password);
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

  return (
    <div className="mx-auto flex min-h-[calc(100vh-0px)] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
          <ChefHat size={28} />
        </div>
        <h1 className="font-heading text-2xl font-bold text-stone-900">
          Create account
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Start your personal recipe vault.
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            Register
          </Button>
        </form>

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

        <p className="mt-4 text-center text-sm text-stone-600">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
