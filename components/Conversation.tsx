"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef } from "react";
import ActionButton from "./ActionButton";
import AtelierButton from "./AtelierButton";
import ChipGroup, { type ChipOption } from "./ChipGroup";
import ProgressMoon from "./ProgressMoon";
import RecipientCard from "./RecipientCard";
import {
  ADULT_END_MESSAGE,
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
  initial,
  reduce,
  stateFromModel,
  toModel,
  type Action,
  type AgeChipId,
  type ChipOccasion,
  type ConversationState,
  type QuestionId,
  type SymbolKey,
} from "../lib/conversation";
import { modelHref } from "../lib/model-param";
import type {
  BudgetBand,
  CategoryPref,
  MetalPref,
  RecipientModel,
  Relationship,
  SymbolChoice,
} from "../lib/matching/types";

/* /find — the conversation (REQ-CV-01 to 17). A pure reducer drives one
   question at a time; every answer is a tap. No network, no storage. */

export const INCOMPLETE_NOTICE =
  "That link did not carry a complete recipient, so let's start again.";

type ConversationProps = {
  initialModel?: RecipientModel;
  notice?: "incomplete";
  momNote: string;
};

const ADULT_CHECK_CHIPS: readonly ChipOption[] = [
  { value: "yes", label: "Yes, Mom" },
  { value: "no", label: "No" },
];

const asOptions = (chips: readonly { value: string; label: string }[]): ChipOption[] =>
  chips.map((c) => ({ value: c.value, label: c.label }));

function init(initialModel?: RecipientModel): ConversationState {
  return initialModel ? stateFromModel(initialModel) : initial;
}

export default function Conversation({ initialModel, notice, momNote }: ConversationProps) {
  const [state, dispatch] = useReducer(reduce, initialModel, init);
  const { answers, step } = state;
  const rootRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef(step);

  // Announce the new question: focus its heading when the step changes (REQ-CV-50).
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    rootRef.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus();
  }, [step]);

  const send = (a: Action) => dispatch(a);

  function renderQuestion(q: QuestionId) {
    const def = QUESTIONS[q];
    let options: readonly ChipOption[] = [];
    let selected: string[] = [];
    let onToggle: (value: string) => void = () => {};

    switch (q) {
      case "relationship":
        options = asOptions(RELATIONSHIP_CHIPS);
        selected = answers.relationship ? [answers.relationship] : [];
        onToggle = (v) => send({ type: "answer", question: "relationship", value: v as Relationship });
        break;
      case "age":
        options = AGE_CHIPS.map((c) => ({ value: c.id, label: c.label }));
        selected = answers.age ? [answers.age] : [];
        onToggle = (v) => send({ type: "answer", question: "age", value: v as AgeChipId });
        break;
      case "adult-check":
        options = ADULT_CHECK_CHIPS;
        selected =
          answers.adultIsMom === undefined ? [] : [answers.adultIsMom ? "yes" : "no"];
        onToggle = (v) => send({ type: "answer", question: "adult-check", value: v === "yes" });
        break;
      case "occasion":
        options = asOptions(OCCASION_CHIPS);
        selected = answers.occasion ? [answers.occasion] : [];
        onToggle = (v) => send({ type: "answer", question: "occasion", value: v as ChipOccasion });
        break;
      case "budget":
        options = asOptions(BUDGET_CHIPS);
        selected = answers.budget ? [answers.budget] : [];
        onToggle = (v) => send({ type: "answer", question: "budget", value: v as BudgetBand });
        break;
      case "metal":
        options = asOptions(METAL_CHIPS);
        selected = answers.metal ? [answers.metal] : [];
        onToggle = (v) => send({ type: "answer", question: "metal", value: v as MetalPref });
        break;
      case "symbols":
        options = asOptions(SYMBOL_CHIPS);
        selected = answers.symbols ? [answers.symbols] : [];
        onToggle = (v) => send({ type: "pick-symbol", value: v as SymbolChoice });
        break;
      case "category":
        options = asOptions(CATEGORY_CHIPS);
        selected = answers.category ? [answers.category] : [];
        onToggle = (v) => send({ type: "answer", question: "category", value: v as CategoryPref });
        break;
    }

    const religious = q === "symbols" && answers.symbols === "religious";

    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <ProgressMoon current={def.number} />
        <h1
          data-step-heading
          tabIndex={-1}
          className="font-display text-3xl font-semibold leading-tight outline-none sm:text-4xl"
        >
          {def.prompt}
        </h1>
        <ChipGroup label={def.prompt} options={options} selected={selected} onToggle={onToggle} />
        {religious ? (
          <div className="flex flex-col items-center gap-5 rounded-2xl bg-champagne px-5 py-6">
            <p className="text-sm text-plum/75">
              Pick any you&rsquo;d like, or none for any religious piece.
            </p>
            <ChipGroup
              label="Religious symbols"
              multi
              options={asOptions(SYMBOL_SUBCHIPS)}
              selected={answers.symbolList ?? []}
              onToggle={(v) => send({ type: "toggle-symbol", key: v as SymbolKey })}
            />
            <ActionButton size="lg" onClick={() => send({ type: "continue" })}>
              Continue
            </ActionButton>
          </div>
        ) : null}
        {backControl()}
      </section>
    );
  }

  // A render function, not a component: it must not remount between renders.
  function backControl() {
    return step === "relationship" && !state.returnToCard ? (
      <Link
        href="/"
        className="inline-flex min-h-11 min-w-11 items-center justify-center px-4 text-sm font-medium text-plum hover:underline"
      >
        Back
      </Link>
    ) : (
      <ActionButton variant="quiet" onClick={() => send({ type: "back" })}>
        Back
      </ActionButton>
    );
  }

  let body;
  if (step === "adult-end") {
    body = (
      <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 text-center">
        <h1
          data-step-heading
          tabIndex={-1}
          className="font-display text-3xl font-semibold leading-tight outline-none sm:text-4xl"
        >
          {ADULT_END_MESSAGE}
        </h1>
        <AtelierButton href="/atelier">Browse the atelier</AtelierButton>
        {backControl()}
      </section>
    );
  } else if (step === "card") {
    const result = toModel(answers);
    body = result.ok ? (
      <RecipientCard
        view={describeModel(result.model, momNote)}
        href={modelHref("/picks", result.model)}
        onEdit={(question) => send({ type: "edit", question })}
        onBack={() => send({ type: "back" })}
      />
    ) : null;
  } else {
    body = renderQuestion(step);
  }

  return (
    <div ref={rootRef} className="flex w-full flex-col items-center gap-6">
      {notice === "incomplete" ? (
        <p role="status" className="rounded-full bg-blush px-5 py-2 text-center text-sm">
          {INCOMPLETE_NOTICE}
        </p>
      ) : null}
      <div className="w-full rounded-3xl bg-blush/50 p-6 sm:p-10">{body}</div>
    </div>
  );
}
