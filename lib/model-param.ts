// Model transport (conversation design §3): the confirmed model travels in the `m` query parameter.
import { canonicalModel, validateModel } from "./conversation";
import type { RecipientModel } from "./matching/types";

export const MODEL_PARAM = "m";
export const MAX_PARAM_LENGTH = 1000;

/** The model as JSON in canonical key order (not yet percent-encoded). */
export function encodeModelParam(model: RecipientModel): string {
  return JSON.stringify(canonicalModel(model));
}

/** `${path}?m=<percent-encoded JSON>`. */
export function modelHref(path: "/picks" | "/find", model: RecipientModel): string {
  const query = new URLSearchParams({ [MODEL_PARAM]: encodeModelParam(model) }).toString();
  return `${path}?${query}`;
}

/** `/piece/<sku>` plus `?m=<percent-encoded model JSON>` when a model is given. */
export function pieceHref(sku: string, model?: RecipientModel): string {
  const path = `/piece/${encodeURIComponent(sku)}`;
  return model ? `${path}?${new URLSearchParams({ [MODEL_PARAM]: encodeModelParam(model) })}` : path;
}

export type ParamResult =
  | { status: "missing" }
  | { status: "invalid"; reason: string }
  | { status: "ok"; model: RecipientModel };

/** Takes the value Next.js already decoded. Never throws. */
export function parseModelParam(raw: string | string[] | undefined): ParamResult {
  if (raw === undefined || raw === "") return { status: "missing" };
  if (typeof raw !== "string") return { status: "invalid", reason: "repeated or non-string value" };
  if (raw.length > MAX_PARAM_LENGTH) return { status: "invalid", reason: "too long" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid", reason: "not JSON" };
  }
  const v = validateModel(parsed);
  return v.ok ? { status: "ok", model: v.model } : { status: "invalid", reason: v.reason };
}
