
import { OrderMode, TabMode } from "./types";

export const ORDER_MODES: OrderMode[] = ["source", "newest", "oldest", "name_asc", "name_desc", "size_desc", "size_asc"];
export const TAB_MODES: TabMode[] = ["overview", "metadata"];

export const ORDER_LABELS: Record<OrderMode, string> = {
    source: "Ordem: origem",
    newest: "Ordem: recentes",
    oldest: "Ordem: antigas",
    name_asc: "Ordem: nome A-Z",
    name_desc: "Ordem: nome Z-A",
    size_desc: "Ordem: maior arquivo",
    size_asc: "Ordem: menor arquivo",
};
