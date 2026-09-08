import activewear from "@/assets/vastraa/activewear.jpg";
import footwear from "@/assets/vastraa/footwear.jpg";
import generic from "@/assets/vastraa/generic.jpg";
import jeans from "@/assets/vastraa/jeans.jpg";
import kidswear from "@/assets/vastraa/kidswear.jpg";
import kurta from "@/assets/vastraa/kurta.jpg";
import saree from "@/assets/vastraa/saree.jpg";
import shirt from "@/assets/vastraa/shirt.jpg";
import type { Product } from "./types";

const RULES: Array<[RegExp, string]> = [
  [/kid|child|boy|girl|infant|toddler/i, kidswear],
  [/saree|sari|lehenga|dupatta|blouse/i, saree],
  [/kurta|kurti|salwar|anarkali|ethnic|palazzo/i, kurta],
  [/jean|denim|trouser|chino|pant/i, jeans],
  [/shirt|tee|t-shirt|top|polo/i, shirt],
  [/shoe|sandal|jutti|sneaker|footwear|heel|loafer/i, footwear],
  [/active|sport|gym|track|yoga|legging/i, activewear],
];

/** Vastraa catalogue photo to use when the item has no picture of its own. */
export function resolveProductImage(product: Partial<Product> | undefined): string {
  if (product?.image_url) return product.image_url;
  const haystack = [product?.category, product?.title, product?.short_description]
    .filter(Boolean)
    .join(" ");
  for (const [pattern, image] of RULES) {
    if (pattern.test(haystack)) return image;
  }
  return generic;
}
