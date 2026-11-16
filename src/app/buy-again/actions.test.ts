import { beforeEach, describe, expect, it, vi } from "vitest";
import { buyAgain } from "./actions";
import { sessionQuery, mutate } from "@/lib/saleor";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/saleor", () => ({ sessionQuery: vi.fn(), liveQuery: vi.fn(), mutate: vi.fn() }));
vi.mock("@/lib/checkout", () => ({
	getIdFromCookies: vi.fn().mockResolvedValue(""),
	saveIdToCookie: vi.fn(),
}));
vi.mock("@/config/channels", () => ({ getStaticStorefrontChannelSlugs: () => ["default-channel"] }));

describe("buy again authorization", () => {
	beforeEach(() => vi.clearAllMocks());
	const input = { orderId: "order", channel: "default-channel", lineIds: ["line"] };

	it("rejects an unconfigured channel before making requests", async () => {
		expect(await buyAgain({ ...input, channel: "private-channel" })).toEqual({ ok: false, error: "invalid" });
		expect(sessionQuery).not.toHaveBeenCalled();
		expect(mutate).not.toHaveBeenCalled();
	});
	it("rejects empty selections without modifying the cart", async () => {
		expect(await buyAgain({ ...input, lineIds: [] })).toEqual({ ok: false, error: "invalid" });
		expect(mutate).not.toHaveBeenCalled();
	});
	it("rejects an order owned by another customer", async () => {
		vi.mocked(sessionQuery).mockResolvedValue({
			ok: true,
			data: { me: { id: "buyer" }, order: { user: { id: "other-buyer" } } },
		});
		expect(await buyAgain(input)).toEqual({ ok: false, error: "signIn" });
		expect(mutate).not.toHaveBeenCalled();
	});
	it("rejects a signed-out customer", async () => {
		vi.mocked(sessionQuery).mockResolvedValue({ ok: true, data: { me: null, order: null } });
		expect(await buyAgain(input)).toEqual({ ok: false, error: "signIn" });
		expect(mutate).not.toHaveBeenCalled();
	});
	it("rejects line ids that are not part of the owned order", async () => {
		vi.mocked(sessionQuery).mockResolvedValue({
			ok: true,
			data: {
				me: { id: "buyer" },
				order: { user: { id: "buyer" }, channel: { slug: "default-channel" }, lines: [] },
			},
		});
		expect(await buyAgain(input)).toEqual({ ok: false, error: "invalid" });
		expect(mutate).not.toHaveBeenCalled();
	});
});
