import "server-only";
import { BuyAgainOrdersDocument } from "@/lib/custom/buy-again-documents";
import { sessionQuery } from "@/lib/saleor";

export function getBuyAgainOrders(after?: string) {
	return sessionQuery(BuyAgainOrdersDocument, { variables: { after } });
}
