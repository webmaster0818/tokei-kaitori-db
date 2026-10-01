// 構造化データの組み立て。各ページは @graph に複数ノードを並べる。
//
// ⚠️ ノードを増やすときは必ず「画面に出ているもの」だけを書く。
//    パンくずはどのページも実際に <nav> で表示しているものと同じ並びにする。
//    ItemList も、そのページに実際にリンクが並んでいる項目だけを入れる
//    （表示していない項目を構造化データだけに入れるとスパム判定の対象になる）。
import { SITE_NAME, SITE_URL } from "./site";

type Node = Record<string, unknown>;

export function graph(...nodes: (Node | null | undefined)[]) {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
}

export const organization: Node = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
};

/** パンくず。items は画面の <nav> と同じ並び（先頭はホーム）。url 省略＝現在地 */
export function breadcrumb(items: { name: string; path?: string }[]): Node {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      ...(it.path ? { item: `${SITE_URL}${it.path}` } : {}),
    })),
  };
}

/** 一覧。entries はそのページに実際に並んでいるリンク */
export function itemList(name: string, entries: { name: string; path: string }[]): Node | null {
  if (!entries.length) return null;
  return {
    "@type": "ItemList",
    name,
    numberOfItems: entries.length,
    itemListElement: entries.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.name,
      url: `${SITE_URL}${e.path}`,
    })),
  };
}
