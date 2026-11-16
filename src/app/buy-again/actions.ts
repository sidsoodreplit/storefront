"use server";

import { refresh } from "next/cache";
import {
	BuyAgainOrderCheckDocument,
	BuyAgainCartDocument,
	BuyAgainCreateCartDocument,
	BuyAgainAddLinesDocument,
} from "@/lib/custom/buy-again-documents";
import { liveQuery, sessionQuery, mutate } from "@/lib/saleor";
import { getIdFromCookies, saveIdToCookie } from "@/lib/checkout";
import { getStaticStorefrontChannelSlugs } from "@/config/channels";
import { planBuyAgain } from "@/lib/account/buy-again-plan";

export async function buyAgain(input: { orderId: string; channel: string; lineIds: string[] }) {
	if (
		typeof input?.orderId !== "string" ||
		!getStaticStorefrontChannelSlugs().includes(input.channel) ||
		!Array.isArray(input.lineIds) ||
		input.lineIds.length === 0 ||
		input.lineIds.length > 100 ||
		!input.lineIds.every((id) => typeof id === "string")
	)
		return { ok: false as const, error: "invalid" as const };

	const result = await sessionQuery(BuyAgainOrderCheckDocument, { variables: { id: input.orderId } });
	if (!result.ok || result.partialErrors) return { ok: false as const, error: "retry" as const };
	const order = result.data.order;
	if (!result.data.me || !order || order.user?.id !== result.data.me.id)
		return { ok: false as const, error: "signIn" as const };
	if (
		order.channel.slug !== input.channel ||
		input.lineIds.some((id) => !order.lines.some((line) => line.id === id))
	)
		return { ok: false as const, error: "invalid" as const };

	const cartId = await getIdFromCookies(input.channel);
	const cartResult = cartId ? await liveQuery(BuyAgainCartDocument, { variables: { id: cartId } }) : null;
	if (cartResult && (!cartResult.ok || cartResult.partialErrors))
		return { ok: false as const, error: "retry" as const };
	const cart = cartResult?.ok ? cartResult.data.checkout : null;
	if (cart && cart.channel.slug !== input.channel) return { ok: false as const, error: "invalid" as const };
	const plan = planBuyAgain(order, input.lineIds, cart?.lines ?? []);
	if (plan.lines.length === 0) return { ok: false as const, error: "unavailable" as const };

	const payload = await (async () => {
		if (cart) {
			const mutation = await mutate(BuyAgainAddLinesDocument, {
				variables: { id: cart.id, lines: plan.lines },
				maxRetries: 0,
			});
			return mutation.ok ? mutation.data.checkoutLinesAdd : undefined;
		}
		const mutation = await mutate(BuyAgainCreateCartDocument, {
			variables: { channel: input.channel, lines: plan.lines },
			maxRetries: 0,
		});
		return mutation.ok ? mutation.data.checkoutCreate : undefined;
	})();
	if (payload === undefined) return { ok: false as const, error: "checkCart" as const };
	if (!payload || payload.errors.length || !payload.checkout)
		return { ok: false as const, error: "changed" as const };
	await saveIdToCookie(input.channel, payload.checkout.id);
	refresh();
	return { ok: true as const, added: plan.added, skipped: plan.skipped };
}
