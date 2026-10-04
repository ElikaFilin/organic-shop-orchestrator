import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { expect, test } from "vitest";
import { App } from "./App";

test("renders the shop name as the page heading", () => {
  // App is the layout and renders an <Outlet />, so it needs a router around it; no child route here.
  const router = createMemoryRouter([{ path: "/", Component: App }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Organic Catalog");
});
