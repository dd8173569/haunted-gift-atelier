import raw from "../data/catalog.json";
import { parseCatalog, type RawCatalog } from "./catalog";

export const catalog = parseCatalog(raw as unknown as RawCatalog);
