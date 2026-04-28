import { Suspense } from "react";
import { AuthPage } from "../components/AuthPage";

export default function SignUp() {
  return (
    <Suspense fallback={null}>
      <AuthPage isSignIn={false} />
    </Suspense>
  );
}
