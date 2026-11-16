"use client";

import { SaleorImage } from "@/ui/atoms/saleor-image";
import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Check, ChevronDown, Package, RotateCcw, ShoppingBag } from "lucide-react";
import type { BuyAgainOrder as BuyAgainOrderFragment } from "@/lib/account/buy-again-plan";
import { buyAgain } from "@/app/buy-again/actions";
import { CART_THUMBNAIL_IMAGE_SIZES } from "@/lib/images";
import { availableQuantity } from "@/lib/account/buy-again-plan";
import { bumpChromeVersion } from "@/lib/chrome-sync";
import { formatMoney, cn } from "@/lib/utils";
import { Button } from "@/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogDescription,
	DialogCloseButton,
} from "@/ui/components/ui/dialog";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { useCart } from "@/ui/components/cart/cart-context";

type Approach = "quick" | "inline" | "review";

export function BuyAgainOrders({ orders, channel }: { orders: BuyAgainOrderFragment[]; channel: string }) {
	const t = useTranslations("buyAgain");
	const [approach, setApproach] = useState<Approach>("quick");
	return (
		<div className="space-y-7">
			<section aria-label={t("compare")} className="rounded-card border bg-muted/40 p-5">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
					<p className="text-eyebrow uppercase tracking-widest text-muted-foreground">{t("compare")}</p>
					<span className="rounded-full border bg-background px-3 py-1 text-xs">{t("live")}</span>
				</div>
				<div className="grid gap-3 sm:grid-cols-3">
					{(["quick", "inline", "review"] as const).map((mode, i) => (
						<button
							key={mode}
							type="button"
							aria-pressed={approach === mode}
							onClick={() => setApproach(mode)}
							className={cn(
								"rounded-card border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								approach === mode
									? "border-primary bg-background shadow-card"
									: "border-transparent hover:bg-background",
							)}
						>
							<span className="text-xs text-muted-foreground">0{i + 1}</span>
							<span className="mt-2 block font-semibold">{t(mode)}</span>
							<span className="mt-1 block text-sm text-muted-foreground">{t(`${mode}Description`)}</span>
						</button>
					))}
				</div>
			</section>
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<RotateCcw className="h-4 w-4" />
				{t("note")}
			</div>
			{orders.map((order) => (
				<BuyAgainCard key={order.id} order={order} channel={channel} approach={approach} />
			))}
		</div>
	);
}

function BuyAgainCard({
	order,
	channel,
	approach,
}: {
	order: BuyAgainOrderFragment;
	channel: string;
	approach: Approach;
}) {
	const t = useTranslations("buyAgain");
	const [expanded, setExpanded] = useState(false);
	const locale = useLocale();
	const [dialog, setDialog] = useState(false);
	const [selected, setSelected] = useState(() =>
		order.lines.filter((line) => availableQuantity(line) > 0).map((line) => line.id),
	);
	const [result, setResult] = useState<Awaited<ReturnType<typeof buyAgain>> | null>(null);
	const [pending, startTransition] = useTransition();
	const busy = useRef(false);
	const { openCart } = useCart();
	const eligible = order.lines.filter((line) => availableQuantity(line) > 0);
	const canBuy = eligible.length > 0 && order.channel.slug === channel;
	const count = order.lines
		.filter((line) => selected.includes(line.id))
		.reduce((sum, line) => sum + availableQuantity(line), 0);
	const subtotal = order.lines
		.filter((line) => selected.includes(line.id))
		.reduce(
			(sum, line) => sum + availableQuantity(line) * (line.variant?.pricing?.price?.gross.amount ?? 0),
			0,
		);
	const currency = order.total.gross.currency;
	const submit = (ids: string[]) => {
		if (busy.current || result?.ok) return;
		busy.current = true;
		startTransition(async () => {
			try {
				const next = await buyAgain({ orderId: order.id, channel, lineIds: ids });
				setResult(next);
				if (next.ok) bumpChromeVersion();
			} catch {
				setResult({ ok: false, error: "checkCart" });
			} finally {
				busy.current = false;
			}
		});
	};
	const action = (ids: string[], label: string) => (
		<Button
			disabled={pending || !canBuy || ids.length === 0 || result?.ok === true}
			onClick={() => submit(ids)}
		>
			{result?.ok ? (
				<Check className="h-4 w-4" />
			) : (
				<RotateCcw className={cn("h-4 w-4", pending && "animate-spin motion-reduce:animate-none")} />
			)}
			{pending ? t("adding") : result?.ok ? t("added") : label}
		</Button>
	);
	const feedback = result && (
		<div
			role={result.ok ? "status" : "alert"}
			aria-live="polite"
			className={cn("rounded-lg border p-4 text-sm", !result.ok && "text-destructive")}
		>
			{result.ok ? (
				<>
					<p className="font-medium">{t("success", { count: result.added })}</p>
					{result.skipped > 0 && (
						<p className="mt-1 text-muted-foreground">{t("skipped", { count: result.skipped })}</p>
					)}
				</>
			) : (
				t(result.error)
			)}
			<Button
				className="mt-2"
				variant="outline-solid"
				onClick={() => {
					setDialog(false);
					openCart();
				}}
			>
				<ShoppingBag className="h-4 w-4" />
				{t("viewCart")}
			</Button>
		</div>
	);
	const picker = (
		<div className="divide-y">
			{order.lines.map((line) => {
				const available = availableQuantity(line);
				return (
					<label
						key={line.id}
						className={cn("flex items-center gap-3 py-4", available === 0 && "text-muted-foreground")}
					>
						<input
							type="checkbox"
							className="h-4 w-4 accent-primary"
							checked={selected.includes(line.id) && available > 0}
							disabled={!available || pending || result?.ok === true}
							onChange={(event) =>
								setSelected((current) =>
									event.target.checked ? [...current, line.id] : current.filter((id) => id !== line.id),
								)
							}
						/>
						<div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted">
							{line.thumbnail ? (
								<SaleorImage
									src={line.thumbnail.url}
									alt=""
									srcSet={`${line.thumbnail.url} 256w`}
									sizes={CART_THUMBNAIL_IMAGE_SIZES}
									className="h-full w-full rounded-lg object-contain"
								/>
							) : (
								<Package className="h-6 w-6" />
							)}
						</div>
						<div className="min-w-0 flex-1">
							<p className="text-sm font-medium">{line.productName}</p>
							<p className="text-xs text-muted-foreground">
								{line.variantName} · {t("quantity", { count: line.quantity })}
							</p>
							<p className="mt-1 text-xs">
								{available === 0
									? t("soldOut")
									: available < line.quantity
										? t("limited", { count: available })
										: t("available")}
							</p>
						</div>
						<span className="text-sm tabular-nums">
							{available ? formatMoney(line.variant!.pricing!.price!.gross.amount, currency) : "—"}
						</span>
					</label>
				);
			})}
		</div>
	);
	return (
		<article className="overflow-hidden rounded-card border bg-card">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-4">
				<div>
					<p className="font-semibold">{t("order", { number: order.number })}</p>
					<p className="mt-1 text-xs text-muted-foreground">
						{new Date(order.created).toLocaleDateString(locale, {
							timeZone: "UTC",
							month: "long",
							day: "numeric",
							year: "numeric",
						})}{" "}
						· {order.statusDisplay}
					</p>
				</div>
				<div className="text-right">
					<p className="text-sm font-medium tabular-nums">
						{formatMoney(order.total.gross.amount, currency)}
					</p>
					<p className="text-xs text-muted-foreground">{t("originalTotal")}</p>
				</div>
			</div>
			<div className="space-y-5 p-5">
				<div className="flex flex-wrap items-center gap-4">
					<div className="flex -space-x-2">
						{order.lines.slice(0, 3).map((line) => (
							<div
								key={line.id}
								className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border-2 border-background bg-muted"
							>
								{line.thumbnail ? (
									<SaleorImage
										src={line.thumbnail.url}
										alt={line.productName}
										srcSet={`${line.thumbnail.url} 256w`}
										sizes={CART_THUMBNAIL_IMAGE_SIZES}
										className="h-full w-full object-contain"
									/>
								) : (
									<Package className="h-6 w-6" />
								)}
							</div>
						))}
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-sm font-medium">{order.lines.map((line) => line.productName).join(", ")}</p>
						<p className="mt-1 text-sm text-muted-foreground">
							{t("availability", { available: eligible.length, total: order.lines.length })}
						</p>
					</div>
				</div>
				{order.channel.slug !== channel && (
					<p className="text-sm text-muted-foreground">{t("otherChannel")}</p>
				)}
				<div className="flex flex-wrap items-center justify-between gap-3">
					<LinkWithChannel
						href={`/account/orders/${order.number}`}
						className="inline-flex items-center gap-2 text-sm underline underline-offset-4"
					>
						{t("details")}
						<ArrowRight className="h-3 w-3" />
					</LinkWithChannel>
					{approach === "quick" &&
						action(
							order.lines.map((line) => line.id),
							t("buyAgain"),
						)}
					{approach === "inline" && (
						<div className="flex gap-2">
							<Button variant="outline-solid" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
								{t("choose")}
								<ChevronDown className="h-4 w-4" />
							</Button>
							{action(expanded ? selected : order.lines.map((line) => line.id), t("buyAgain"))}
						</div>
					)}
					{approach === "review" && (
						<Button disabled={!canBuy || result?.ok === true} onClick={() => setDialog(true)}>
							<RotateCcw className="h-4 w-4" />
							{result?.ok ? t("added") : t("reviewButton")}
						</Button>
					)}
				</div>
				{approach === "inline" && expanded && (
					<div className="border-t pt-2">
						{picker}
						<p className="text-right text-sm">
							{t("subtotal")} · {formatMoney(subtotal, currency)}
						</p>
					</div>
				)}
				{!dialog && feedback}
			</div>
			<Dialog open={dialog} onOpenChange={setDialog}>
				<DialogContent className="m-auto h-fit max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-card bg-background p-6 shadow-overlay">
					<div className="flex items-start justify-between gap-3">
						<div>
							<DialogTitle>{t("dialogTitle")}</DialogTitle>
							<DialogDescription className="mt-2">
								{t("dialogDescription", { number: order.number })}
							</DialogDescription>
						</div>
						<DialogCloseButton aria-label={t("close")} />
					</div>
					{picker}
					<div className="mt-4 flex items-center justify-between border-t pt-4">
						<div>
							<p className="text-sm text-muted-foreground">{t("subtotal")}</p>
							<p className="text-xl font-semibold">{formatMoney(subtotal, currency)}</p>
						</div>
						{action(selected, t("addCount", { count }))}
					</div>
					<p className="mt-3 text-xs text-muted-foreground">{t("priceNote")}</p>
					<div className="mt-4">{feedback}</div>
				</DialogContent>
			</Dialog>
		</article>
	);
}
