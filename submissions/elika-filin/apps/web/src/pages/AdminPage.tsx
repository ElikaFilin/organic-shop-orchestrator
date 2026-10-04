import { useEffect, useState } from "react";
import type { AdminProductsResponse, AdminSettings, DataSource } from "@organic/shared";
import {
  adminLogin,
  adminLogout,
  getAdminProducts,
  getAdminSession,
  getAdminSettings,
  setProductVisibility,
  updateSettings,
} from "../api/client";
import { AdminLoginForm } from "../components/AdminLoginForm";
import { AdminShopSection } from "../components/AdminShopSection";

type State =
  | { status: "checking" }
  | { status: "anonymous" }
  | { status: "loading" }
  | { status: "ready"; settings: AdminSettings; products: AdminProductsResponse; saved: boolean; alert?: string }
  | { status: "failed" };

const SOURCE_LABEL: Record<DataSource, string> = { live: "Наживо", snapshot: "Знімок" };
const SAVE_FAILED = "Не вдалося зберегти";
const LOAD_FAILED = "Не вдалося завантажити адмін-панель";

/** The owner's panel: the data source and which products of each shop the storefront shows. */
export function AdminPage() {
  const [state, setState] = useState<State>({ status: "checking" });

  async function loadPanel(): Promise<void> {
    try {
      const [settings, products] = await Promise.all([getAdminSettings(), getAdminProducts()]);
      setState({ status: "ready", settings, products, saved: false });
    } catch {
      setState({ status: "failed" });
    }
  }

  useEffect(() => {
    let cancelled = false;
    void getAdminSession().then(
      async (session) => {
        if (cancelled) return;
        if (!session.authenticated) return setState({ status: "anonymous" });
        setState({ status: "loading" });
        await loadPanel();
      },
      () => {
        if (!cancelled) setState({ status: "failed" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(token: string): Promise<void> {
    // A rejection is left to the form, which owns the alert and stays on screen.
    await adminLogin(token);
    setState({ status: "loading" });
    await loadPanel();
  }

  async function switchSource(dataSource: DataSource): Promise<void> {
    try {
      const settings = await updateSettings({ dataSource });
      setState((current) =>
        current.status === "ready" ? { ...current, settings, saved: true, alert: undefined } : current,
      );
    } catch {
      // Nothing was saved, so the radios re-render from the unchanged state and no success is left over.
      setState((current) =>
        current.status === "ready" ? { ...current, saved: false, alert: SAVE_FAILED } : current,
      );
      return;
    }
    // The two sources list different products, so the sections are reloaded after the switch — its own
    // step, because a failed reload is a failed load, not a failed save: the switch did apply.
    try {
      const products = await getAdminProducts();
      setState((current) => (current.status === "ready" ? { ...current, products } : current));
    } catch {
      setState((current) => (current.status === "ready" ? { ...current, alert: LOAD_FAILED } : current));
    }
  }

  async function toggleProduct(productId: string, visible: boolean): Promise<void> {
    try {
      const result = await setProductVisibility(productId, visible);
      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              alert: undefined,
              products: {
                ...current.products,
                products: current.products.products.map((product) =>
                  product.id === result.id ? { ...product, visible: result.visible } : product,
                ),
              },
            }
          : current,
      );
    } catch {
      // Same rule as the source switch: a failure never leaves an earlier "Збережено" on screen.
      setState((current) =>
        current.status === "ready" ? { ...current, saved: false, alert: SAVE_FAILED } : current,
      );
    }
  }

  async function logout(): Promise<void> {
    await adminLogout();
    setState({ status: "anonymous" });
  }

  if (state.status === "checking" || state.status === "loading") return <p role="status">Завантажуємо…</p>;
  if (state.status === "failed") return <p role="status">{LOAD_FAILED}</p>;
  if (state.status === "anonymous") return <AdminLoginForm onSubmit={login} />;

  const { settings, products, saved, alert } = state;
  return (
    <section className="mt-6">
      <h2 className="text-xl font-semibold">Адмін-панель</h2>
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">Джерело даних</legend>
        {(["live", "snapshot"] as const).map((source) => (
          <label key={source} className="mr-4 inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="dataSource"
              value={source}
              checked={settings.dataSource === source}
              onChange={() => void switchSource(source)}
            />
            {SOURCE_LABEL[source]}
          </label>
        ))}
      </fieldset>
      {saved && (
        <p role="status" className="mt-2 text-sm text-emerald-700">
          Збережено
        </p>
      )}
      {products.shops.map((shop) => (
        <AdminShopSection
          key={shop.key}
          shop={shop}
          products={products.products.filter((product) => product.shopKey === shop.key)}
          onToggle={(productId, visible) => void toggleProduct(productId, visible)}
        />
      ))}
      {alert !== undefined && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {alert}
        </p>
      )}
      <button type="button" onClick={() => void logout()} className="mt-6 rounded-md border border-stone-300 px-3 py-2 text-sm">
        Вийти
      </button>
    </section>
  );
}
