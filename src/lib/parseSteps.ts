import type { Step } from "@/types/recipe";

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent?.trim() ?? "";
}

function decodeEntities(text: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

function cleanText(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")   // &nbsp;
    .replace(/\s+/g, " ")
    .trim();
}

function parseFromHtml(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const items = doc.querySelectorAll(
    ".direction-list-item, [data-content], li",
  );

  if (items.length > 0) {
    const steps: string[] = [];
    items.forEach((el) => {
      const wrapper = el.querySelector(".details-wrapper");
      const raw =
        wrapper?.textContent ??
        decodeEntities(el.getAttribute("data-content") ?? "") ??
        el.textContent ??
        "";
      const text = cleanText(raw);
      if (text) steps.push(text);
    });
    if (steps.length > 0) return steps;
  }

  return [cleanText(stripHtml(html))].filter(Boolean);
}

function parseFromPlainText(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => {
      return line
        .replace(/^\s*\d+[\.\)\-:]\s*/, "")  // strip leading "1. " / "1) " / "1- "
        .trim();
    })
    .filter(Boolean);
}

const HTML_TAG_REGEX = /<\/?[a-z][\s\S]*?>/i;

export function parseStepsText(
  input: string,
  startSortOrder = 0,
): Step[] {
  const isHtml = HTML_TAG_REGEX.test(input);
  const lines = isHtml ? parseFromHtml(input) : parseFromPlainText(input);

  return lines.map((instruction, i) => ({
    instruction,
    imageUrl: null,
    sortOrder: startSortOrder + i,
  }));
}
