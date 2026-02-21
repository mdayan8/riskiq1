import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("Admin User");
  const [email, setEmail] = useState("admin@riskiq.local");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "register") {
        await api.post("/auth/register", { name, email, password, role: "Admin" });
      }
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("riskiq_token", data.token);
      localStorage.setItem("riskiq_user", JSON.stringify(data.user));
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-12 max-w-md card p-6">
      <h2 className="text-2xl font-semibold text-blue-800">RiskIQ Access</h2>
      <p className="mt-1 text-sm text-slate-500">Live backend authentication enabled.</p>

      <div className="mt-4 flex gap-2">
        <button onClick={() => setMode("login")} className={`rounded-full px-3 py-1.5 text-xs ${mode === "login" ? "bg-blue-700 text-white" : "bg-slate-200"}`}>Login</button>
        <button onClick={() => setMode("register")} className={`rounded-full px-3 py-1.5 text-xs ${mode === "register" ? "bg-blue-700 text-white" : "bg-slate-200"}`}>Register</button>
      </div>

      <form className="mt-4 space-y-3" onSubmit={submit}>
        {mode === "register" && (
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        )}
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-blue-700 px-3 py-2 text-white disabled:opacity-60">
          {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>

      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        Demo account: <strong>admin@riskiq.local</strong> / <strong>password</strong>
      </div>
    </div>
  );
}
