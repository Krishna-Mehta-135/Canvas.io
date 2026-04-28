import { Suspense } from "react";
import { AuthPage } from "../components/AuthPage";

export default function SignIn() {
  return (
    <Suspense fallback={null}>
      <AuthPage isSignIn={true} />
    </Suspense>
  );
}
