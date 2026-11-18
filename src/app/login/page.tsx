import { Layers } from "lucide-react";
import Link from "next/link";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="standalone"><Link href="/" className="brand"><span className="brand-icon"><Layers size={23} /></span>hostop.</Link><h1>Welcome back.</h1><p>Your guests are in good hands.</p><form className="auth-form" action="/api/auth/login" method="post"><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label><label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>{error && <p className="form-error">Sign-in failed. Check your credentials and try again.</p>}<button className="primary-button">Sign in</button></form></main>;
}