import { describe, expect, it } from "vitest";
import type { BuyAgainOrderFragment } from "@/gql/buy-again/graphql";
import { availableQuantity, planBuyAgain } from "./buy-again-plan";

function order(): BuyAgainOrderFragment {
	return {
		id: "order",
		number: "1",
		created: "2026-11-01",
		statusDisplay: "Delivered",
		channel: { slug: "default-channel" },
		total: { gross: { amount: 20, currency: "USD" } },
		lines: [
			{
				id: "line",
				productName: "Tea",
				variantName: "Box",
				quantity: 3,
				variant: {
					id: "variant",
					quantityAvailable: 5,
					product: { isAvailableForPurchase: true },
					pricing: { price: { gross: { amount: 10, currency: "USD" } } },
				},
			},
		],
	};
}

describe("buy again quantities", () => {
	it("adds the original quantity without replacing existing cart lines", () => {
		expect(planBuyAgain(order(), ["line"], [{ variant: { id: "other" }, quantity: 7 }])).toEqual({
			lines: [{ variantId: "variant", quantity: 3 }],
			added: 3,
			skipped: 0,
		});
	});
	it("caps additions by stock minus items already in the cart", () => {
		expect(planBuyAgain(order(), ["line"], [{ variant: { id: "variant" }, quantity: 4 }])).toEqual({
			lines: [{ variantId: "variant", quantity: 1 }],
			added: 1,
			skipped: 2,
		});
	});
	it("skips deleted variants", () => {
		const input = order();
		input.lines[0].variant = null;
		expect(planBuyAgain(input, ["line"], [])).toEqual({ lines: [], added: 0, skipped: 3 });
	});
	it("skips out of stock, unavailable and unpriced products", () => {
		const input = order();
		input.lines[0].variant!.quantityAvailable = 0;
		expect(availableQuantity(input.lines[0])).toBe(0);
		input.lines[0].variant!.quantityAvailable = 5;
		input.lines[0].variant!.product.isAvailableForPurchase = false;
		expect(availableQuantity(input.lines[0])).toBe(0);
		input.lines[0].variant!.product.isAvailableForPurchase = true;
		input.lines[0].variant!.pricing = null;
		expect(availableQuantity(input.lines[0])).toBe(0);
	});
	it("does not add unselected lines", () => {
		expect(planBuyAgain(order(), [], [])).toEqual({ lines: [], added: 0, skipped: 0 });
	});
	it("does not double-count duplicate line selections", () => {
		expect(planBuyAgain(order(), ["line", "line"], []).added).toBe(3);
	});
	it("aggregates duplicate variants within stock", () => {
		const input = order();
		input.lines.push({ ...input.lines[0], id: "second" });
		expect(planBuyAgain(input, ["line", "second"], [])).toEqual({
			lines: [{ variantId: "variant", quantity: 5 }],
			added: 5,
			skipped: 1,
		});
	});
	it("does not add when existing cart quantity already exceeds stock", () => {
		expect(planBuyAgain(order(), ["line"], [{ variant: { id: "variant" }, quantity: 8 }])).toEqual({
			lines: [],
			added: 0,
			skipped: 3,
		});
	});
});
