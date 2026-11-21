// Test helpers: render the route pages by calling the async page function and rendering its element
// (design §7.2), and drive the conversation through the DOM. Each importing test file mocks next/image.
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import AtelierPage from "../../app/atelier/page";
import FindPage from "../../app/find/page";
import Home from "../../app/page";
import PicksPage from "../../app/picks/page";
import PieceNotFound from "../../app/piece/[sku]/not-found";
import PiecePage from "../../app/piece/[sku]/page";
import {
  AGE_CHIPS,
  BUDGET_CHIPS,
  CATEGORY_CHIPS,
  METAL_CHIPS,
  OCCASION_CHIPS,
  QUESTIONS,
  RELATIONSHIP_CHIPS,
  SYMBOL_CHIPS,
  SYMBOL_SUBCHIPS,
  describeModel,
  toModel,
  type Action,
  type ConversationState,
} from "../../lib/conversation";
import { encodeModelParam } from "../../lib/model-param";
import { STORAGE_KEY, serializeCalibration } from "../../lib/true-size";
import { run } from "./conversation-taps";
import { catalog } from "./matching-fixtures";

type SP = { [key: string]: string | string[] | undefined };

export const renderLanding = () => render(<Home />);
export const renderNotFound = () => render(<PieceNotFound />);

export async function renderFind(sp: SP = {}) {
  return render((await FindPage({ searchParams: Promise.resolve(sp) })) as ReactElement);
}
export async function renderPicks(m: string) {
  return render((await PicksPage({ searchParams: Promise.resolve({ m }) })) as ReactElement);
}
export async function renderAtelier(sp: SP = {}) {
  return render((await AtelierPage({ searchParams: Promise.resolve(sp) })) as ReactElement);
}
export async function renderPiece(sku: string, m?: string) {
  const el = await PiecePage({
    params: Promise.resolve({ sku }),
    searchParams: Promise.resolve(m === undefined ? {} : { m }),
  });
  return render(el as ReactElement);
}

/** The `m` parameter of a model reached by these taps. */
export function modelParamFor(taps: Action[]): string {
  const r = toModel(run(taps).answers);
  if (!r.ok) throw new Error("taps do not complete a model");
  return encodeModelParam(r.model);
}

/** Stores a calibration the way the viewer would (device pixel ratio 1 in jsdom). */
export function storeCalibration(pxPerMm = 4): void {
  window.localStorage.setItem(STORAGE_KEY, serializeCalibration({ pxPerMm, dpr: window.devicePixelRatio }));
}

export const ALL_SKUS = catalog.products.map((p) => p.sku);

const chipsFor = (q: string): readonly { value: string; label: string }[] => {
  switch (q) {
    case "relationship":
      return RELATIONSHIP_CHIPS;
    case "age":
      return AGE_CHIPS.map((c) => ({ value: c.id, label: c.label }));
    case "adult-check":
      return [
        { value: "true", label: "Yes, Mom" },
        { value: "false", label: "No" },
      ];
    case "occasion":
      return OCCASION_CHIPS;
    case "budget":
      return BUDGET_CHIPS;
    case "metal":
      return METAL_CHIPS;
    case "symbols":
      return SYMBOL_CHIPS;
    case "category":
      return CATEGORY_CHIPS;
    default:
      throw new Error(`no chips for ${q}`);
  }
};

/**
 * Performs one reducer action through the rendered controls. `state` is the state BEFORE the action
 * (the caller keeps it with `reduce`); it names the visible group and the Edit button.
 */
export function tapUi(state: ConversationState, a: Action): void {
  switch (a.type) {
    case "answer": {
      const value = String(a.value);
      const label = chipsFor(a.question).find((c) => c.value === value)?.label;
      if (label === undefined) throw new Error(`no chip ${a.question}/${value}`);
      const group = screen.getByRole("group", { name: QUESTIONS[a.question].prompt });
      fireEvent.click(within(group).getByRole("button", { name: label }));
      return;
    }
    case "pick-symbol": {
      const label = SYMBOL_CHIPS.find((c) => c.value === a.value)?.label;
      const group = screen.getByRole("group", { name: QUESTIONS.symbols.prompt });
      fireEvent.click(within(group).getByRole("button", { name: label }));
      return;
    }
    case "toggle-symbol": {
      const label = SYMBOL_SUBCHIPS.find((c) => c.value === a.key)?.label;
      const group = screen.getByRole("group", { name: "Religious symbols" });
      fireEvent.click(within(group).getByRole("button", { name: label }));
      return;
    }
    case "continue":
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      return;
    case "back":
      // First question shows a link, every other step a button; both are named "Back".
      fireEvent.click(screen.getByText("Back"));
      return;
    case "edit": {
      const r = toModel(state.answers);
      if (!r.ok) throw new Error("edit needs a complete card");
      const line = describeModel(r.model, "").lines.find((l) => l.question === a.question);
      fireEvent.click(screen.getByRole("button", { name: `Edit ${line?.label}` }));
      return;
    }
    default:
      throw new Error(`action ${a.type} has no control`);
  }
}
