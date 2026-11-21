// Shared generator helper (P-CV and P-PD-7): the actions the UI could send from a state.
import {
  AGE_CHIPS,
  BUDGET_CHIPS,
  CATEGORY_CHIPS,
  METAL_CHIPS,
  OCCASION_CHIPS,
  ORDER,
  RELATIONSHIP_CHIPS,
  SYMBOL_CHIPS,
  SYMBOL_KEYS,
  applicable,
  type Action,
  type ConversationState,
} from "../../lib/conversation";
import { adultIsMom, age, budget, cat, metal, occ, rel, sym } from "./conversation-taps";

/** Every action the UI could send from this state (plus back, edit, restart). */
export function legalActions(s: ConversationState): Action[] {
  const out: Action[] = [{ type: "back" }, { type: "restart" }];
  switch (s.step) {
    case "relationship":
      out.push(...RELATIONSHIP_CHIPS.map((c) => rel(c.value)));
      break;
    case "age":
      out.push(...AGE_CHIPS.map((c) => age(c.id)));
      break;
    case "adult-check":
      out.push(adultIsMom(true), adultIsMom(false));
      break;
    case "occasion":
      out.push(...OCCASION_CHIPS.map((c) => occ(c.value)));
      break;
    case "budget":
      out.push(...BUDGET_CHIPS.map((c) => budget(c.value)));
      break;
    case "metal":
      out.push(...METAL_CHIPS.map((c) => metal(c.value)));
      break;
    case "symbols":
      out.push(...SYMBOL_CHIPS.map((c) => sym(c.value)));
      if (s.answers.symbols === "religious") {
        out.push(...SYMBOL_KEYS.map((key) => ({ type: "toggle-symbol", key }) as Action), { type: "continue" });
      }
      break;
    case "category":
      out.push(...CATEGORY_CHIPS.map((c) => cat(c.value)));
      break;
    case "card":
    case "adult-end":
      break;
  }
  // The UI offers Edit only on the card.
  if (s.step === "card") {
    out.push(...ORDER.filter((q) => applicable(q, s.answers)).map((question) => ({ type: "edit", question }) as Action));
  }
  return out;
}

/**
 * Picks one action by index from a state: biased toward answers when `bias < 7`. The UI has no
 * "restart" control, so it is never picked here (a flow driven through the DOM needs a real control).
 */
export function pickAction(s: ConversationState, index: number, bias: number): Action {
  const legal = legalActions(s).filter((a) => a.type !== "restart");
  const answers = legal.filter((a) => a.type !== "back" && a.type !== "edit");
  const pool = bias < 7 && answers.length > 0 ? answers : legal;
  return pool[index % pool.length];
}
