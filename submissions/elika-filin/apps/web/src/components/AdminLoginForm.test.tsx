import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { AdminLoginForm } from "./AdminLoginForm";

type Submit = (token: string) => Promise<void>;

/** The client's rejection shape: an Error that also carries the HTTP status. */
const withStatus = (message: string, status: number): Error => Object.assign(new Error(message), { status });

function renderForm(onSubmit: Submit) {
  render(<AdminLoginForm onSubmit={onSubmit} />);
}

function typeAndSubmit(token: string) {
  fireEvent.change(screen.getByLabelText("Токен адміністратора"), { target: { value: token } });
  fireEvent.click(screen.getByRole("button", { name: "Увійти" }));
}

test("Submit passes the typed token", async () => {
  const onSubmit = vi.fn<Submit>().mockResolvedValue(undefined);
  renderForm(onSubmit);

  expect(screen.getByRole("heading", { level: 2, name: "Вхід для адміністратора" })).toBeInTheDocument();
  expect(screen.getByLabelText("Токен адміністратора")).toHaveAttribute("type", "password");

  typeAndSubmit("secret-token");

  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit).toHaveBeenCalledWith("secret-token");
  expect(screen.queryByRole("alert")).toBeNull();
});

test.each([
  { reason: "401", error: withStatus("POST /api/admin/login failed: 401", 401), text: "Невірний токен" },
  { reason: "503", error: withStatus("POST /api/admin/login failed: 503", 503), text: "Адмінку не налаштовано" },
  { reason: "500", error: withStatus("POST /api/admin/login failed: 500", 500), text: "Не вдалося увійти" },
  { reason: "no status", error: new Error("boom"), text: "Не вдалося увійти" },
])("Alert text per status ($reason)", async ({ error, text }) => {
  renderForm(vi.fn<Submit>().mockRejectedValue(error));

  typeAndSubmit("secret-token");

  expect(await screen.findByRole("alert")).toHaveTextContent(text);
  // The form stays: the admin can try again.
  expect(screen.getByRole("heading", { level: 2, name: "Вхід для адміністратора" })).toBeInTheDocument();
});

test("Alert is cleared on the next submit", async () => {
  const onSubmit = vi
    .fn<Submit>()
    .mockRejectedValueOnce(withStatus("POST /api/admin/login failed: 401", 401))
    // The second attempt never settles, so whatever is on screen after the click is the reset alone.
    .mockReturnValueOnce(new Promise<void>(() => {}));
  renderForm(onSubmit);

  typeAndSubmit("secret-token");
  expect(await screen.findByRole("alert")).toHaveTextContent("Невірний токен");

  fireEvent.click(screen.getByRole("button", { name: "Увійти" }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("alert")).toBeNull();
});
