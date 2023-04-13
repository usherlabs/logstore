export interface ApiAuthentication {
	keys: string[];
}

// TODO: Implement the authentication check.
export const isValidAuthentication = (
	apiKey?: string,
	apiAuthentication?: ApiAuthentication
): boolean => {
	if (apiAuthentication !== undefined) {
		if (apiKey === undefined) {
			return false;
		}
		return apiAuthentication.keys.includes(apiKey);
	} else {
		return true;
	}
};

// TODO: Implement the authentication check.
// export const createApiAuthenticator = (config: Config): ApiAuthenticator => {
// 	if (config.apiAuthentication !== undefined) {
// 		return {
// 			isValidAuthentication: (apiKey?: string) => {
// 				if (apiKey === undefined) {
// 					return false;
// 				}
// 				return config.apiAuthentication!.keys.includes(apiKey!);
// 			},
// 		};
// 	} else {
// 		return {
// 			isValidAuthentication: () => true,
// 		};
// 	}
// };
