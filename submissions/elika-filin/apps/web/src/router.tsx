import { createBrowserRouter, type RouteObject } from "react-router";
import { App } from "./App";
import { CatalogPage } from "./pages/CatalogPage";

// Exported separately so tests can build a memory router over the very same route tree.
export const routes: RouteObject[] = [
  { path: "/", Component: App, children: [{ index: true, Component: CatalogPage }] },
];

export const router = createBrowserRouter(routes);
