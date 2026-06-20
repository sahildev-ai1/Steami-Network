import { useCallback } from "react";
import { api } from "@/lib/api";

type PopupType = "explainer" | "research" | "simulation" | "blog" | "article" | "feed" | "insight" | "diary";

const routeForPopup = (type: PopupType, id: string) => {
  const encoded = encodeURIComponent(id);
  if (type === "explainer") return `/explainers?explainer=${encoded}`;
  if (type === "research") return `/research?research=${encoded}`;
  if (type === "simulation") return `/simulations?simulation=${encoded}`;
  if (type === "blog") return `/blog/${encoded}`;
  if (type === "article") return `/articles/${encoded}`;
  if (type === "feed") return `/?feed=${encoded}`;
  if (type === "insight") return `/?insight=${encoded}`;
  return `/dashboard?diary=${encoded}`;
};

export function getPopupLink(type: PopupType, id: string, origin = typeof window === "undefined" ? "" : window.location.origin) {
  return `${origin}${routeForPopup(type, id)}`;
}

export function getPopupRoute(type: PopupType, id: string) {
  return routeForPopup(type, id);
}

export function usePopupLink(type: PopupType, id: string, title?: string) {
  const link = getPopupLink(type, id);

  const logOpen = useCallback(() => {
    api.dashboard.event({ popup_type: type, popup_id: id, popup_title: title }).catch(() => undefined);
  }, [id, title, type]);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(link);
    return link;
  }, [link]);

  return { link, copy, logOpen };
}
