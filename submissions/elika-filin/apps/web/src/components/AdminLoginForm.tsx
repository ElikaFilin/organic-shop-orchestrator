import { useState, type FormEvent } from "react";

/** The alert text for a failed login: the client's ApiError carries the status the page branches on. */
export function loginAlert(error: unknown): string {
  const status = (error as { status?: unknown }).status;
  if (status === 401) return "Невірний токен";
  if (status === 503) return "Адмінку не налаштовано";
  return "Не вдалося увійти";
}

/** The token form. It owns its alert, so a successful login unmounts it without touching that state. */
export function AdminLoginForm({ onSubmit }: { onSubmit: (token: string) => Promise<void> }) {
  const [token, setToken] = useState("");
  const [alert, setAlert] = useState<string>();

  function submit(event: FormEvent) {
    event.preventDefault();
    // Cleared before the attempt, so the previous failure never lingers beside a pending one.
    setAlert(undefined);
    void onSubmit(token).catch((error: unknown) => setAlert(loginAlert(error)));
  }

  return (
    <form onSubmit={submit} className="mt-6 max-w-sm">
      <h2 className="text-xl font-semibold">Вхід для адміністратора</h2>
      <label className="mt-4 block text-sm">
        Токен адміністратора
        <input
          type="password"
          value={token}
          onChange={(event) => setToken(event.currentTarget.value)}
          className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2"
        />
      </label>
      <button type="submit" className="mt-3 rounded-md border border-stone-300 px-3 py-2 text-sm">
        Увійти
      </button>
      {alert !== undefined && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {alert}
        </p>
      )}
    </form>
  );
}
