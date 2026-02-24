import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
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
      <p className="mt-1 text-sm text-slate-500">Secure access is restricted to authorized credentials.</p>

      <form className="mt-4 space-y-3" onSubmit={submit}>
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-blue-700 px-3 py-2 text-white disabled:opacity-60">
          {loading ? "Please wait..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
