import type { DocumentTypeDecoration } from "@graphql-typed-document-node/core";
import { TypedDocumentString } from "@/gql/graphql";
import * as generated from "@/gql/buy-again/graphql";

// Isolated codegen documents must use the kernel's nominal TypedDocumentString class.
function document<Result, Variables>(value: String & DocumentTypeDecoration<Result, Variables>) {
	return new TypedDocumentString<Result, Variables>(value.toString());
}

export const BuyAgainOrdersDocument = document(generated.BuyAgainOrdersDocument);
export const BuyAgainOrderCheckDocument = document(generated.BuyAgainOrderCheckDocument);
export const BuyAgainCartDocument = document(generated.BuyAgainCartDocument);
export const BuyAgainCreateCartDocument = document(generated.BuyAgainCreateCartDocument);
export const BuyAgainAddLinesDocument = document(generated.BuyAgainAddLinesDocument);
