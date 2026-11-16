import config from "./.graphqlrc";

export default {
	...config,
	documents: "src/graphql/extensions/BuyAgain.graphql",
	generates: {
		"src/gql/buy-again/": config.generates!["src/gql/"],
	},
};
