import { supabase } from "../lib/supabase";

export default function Login() {
  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) console.error(error);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Login</h1>
      <button onClick={loginWithGoogle}>Google로 로그인</button>
    </div>
  );
}
