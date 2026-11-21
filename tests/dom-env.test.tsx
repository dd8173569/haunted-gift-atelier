// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import "./helpers/dom";

it("runs in jsdom with jest-dom matchers", () => {
  render(<button aria-pressed="true">x</button>);
  expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
});
