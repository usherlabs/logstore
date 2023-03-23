export const STAKE_TOKEN_CONTRACTS: Record<string, string> = {
	'5': '0xbAf0892F01B8d2F456A80172627A3F6EA0253C80', //for hardhat we use our predeplyed token
	'8997': '0xbAA81A0179015bE47Ad439566374F2Bae098686F', //for streamr dev we use our predeplyed token
	'137': '0x3a9A81d576d83FF21f26f325066054540720fC34', // for polygon data token
	'80001': '0x3a9A81d576d83FF21f26f325066054540720fC34', // for mumbai random token cus no data deployed there
};

export const STREAMR_REGISTRY_ADDRESS: Record<string, string> = {
	'5': '0xb7035e1572b3df33703f412f448691b36cc714ae', //for hardhat we use our mock token
	'8997': '0x6cCdd5d866ea766f6DF5965aA98DeCCD629ff222',
	'137': '0x0D483E10612F327FC11965Fc82E90dC19b141641',
	'80001': '0xb341829f43EaF631C73D29dcd3C26637d1695e42',
};
