import { useEffect, useState } from "react";
import { api } from "../lib/api";

function Dot({ ok }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />;
}

export default function ApiStatus() {
  const [status, setStatus] = useState({ backend: false, ai: false });

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const { data } = await api.get("/health/system");
        if (active) {
          setStatus({
            backend: data?.services?.backend === true,
            ai: data?.services?.ai === true
          });
        }
      } catch {
        if (active) setStatus({ backend: false, ai: false });
      }
    };

    check();
    const id = setInterval(check, 7000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex items-center gap-4 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700">
      <span className="flex items-center gap-1.5"><Dot ok={status.backend} /> Backend</span>
      <span className="flex items-center gap-1.5"><Dot ok={status.ai} /> AI</span>
    </div>
  );
}
