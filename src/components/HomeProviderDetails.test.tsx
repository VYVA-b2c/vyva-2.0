import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { HomeProviderDetails } from "./HomeProviderDetails";

afterEach(cleanup);
it("updates labels to French without changing the provider address or links", () => {
  const snapshot = { maps_url: "https://maps.google.com/?cid=123", search_area_fallback: true, search_area: "Tarifa, Spain" };
  const view = render(<HomeProviderDetails isSpanish={false} language="en" snapshot={snapshot} />);
  view.rerender(<HomeProviderDetails isSpanish={false} language="fr" snapshot={snapshot} />);
  expect(screen.getByRole("link", { name: "Voir la carte" })).toHaveAttribute("href", snapshot.maps_url);
  expect(screen.getByText(/Tarifa, Spain/)).toBeInTheDocument();
  expect(screen.queryByText("View map")).not.toBeInTheDocument();
});
it("renders source links and published closing hours", () => {
  render(<HomeProviderDetails isSpanish={false} snapshot={{ maps_url: "https://maps.google.com/?cid=123", website_url: "https://example.com", opening_hours_text: ["Monday: 09:00 - 18:00"] }} />);
  expect(screen.getByRole("link", { name: "View map" })).toHaveAttribute("href", "https://maps.google.com/?cid=123");
  expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.getByText("Monday: 09:00 - 18:00")).toBeInTheDocument();
});
it("does not invent hours or render unsafe source links", () => {
  render(<HomeProviderDetails isSpanish={false} snapshot={{ maps_url: "javascript:alert(1)" }} />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.queryByText("Opening hours")).not.toBeInTheDocument();
});
