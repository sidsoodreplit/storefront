import type { BuyAgainOrderFragment } from "@/gql/buy-again/graphql";

export type BuyAgainOrder = BuyAgainOrderFragment;

export function availableQuantity(line: BuyAgainOrderFragment["lines"][number]) {
	if (!line.variant?.product.isAvailableForPurchase || !line.variant.pricing?.price) return 0;
	return Math.max(0, Math.min(line.quantity, line.variant.quantityAvailable ?? 0));
}

export function planBuyAgain(
	order: BuyAgainOrderFragment,
	selected: readonly string[],
	cart: readonly { quantity: number; variant: { id: string } }[],
) {
	const quantities = new Map(cart.map((line) => [line.variant.id, line.quantity]));
	const additions = new Map<string, number>();
	let requested = 0;
	for (const line of order.lines) {
		if (!selected.includes(line.id)) continue;
		requested += line.quantity;
		const variant = line.variant;
		if (!variant) continue;
		const quantity = Math.max(
			0,
			Math.min(availableQuantity(line), (variant.quantityAvailable ?? 0) - (quantities.get(variant.id) ?? 0)),
		);
		if (quantity === 0) continue;
		quantities.set(variant.id, (quantities.get(variant.id) ?? 0) + quantity);
		additions.set(variant.id, (additions.get(variant.id) ?? 0) + quantity);
	}
	const lines = [...additions].map(([variantId, quantity]) => ({ variantId, quantity }));
	const added = lines.reduce((sum, line) => sum + line.quantity, 0);
	return { lines, added, skipped: requested - added };
}
