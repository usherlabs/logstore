import React, { useMemo } from 'react';
import Redoc from '@theme/Redoc';
import useSpecData from '@theme/useSpecData';
import type theme from 'redocusaurus/src/theme';

const ApiDocMdxModified: React.FC<theme.Props> = ({
	id,
}: theme.Props): JSX.Element => {
	const specProps = useSpecData(id);
	const optionsOverrides = useMemo(() => {
		// https://redocly.com/docs/api-reference-docs/configuration/functionality/
		return {
			disableSearch: true,
			hideDownloadButton: true,
			generateCodeSamples: {
				languages: [
					{ lang: 'curl' },
					{ lang: 'Node.js' },
					{ lang: 'JavaScript', label: 'JS' },
				],
				skipOptionalParameters: true,
			},
			theme: {
				// TODO: Investigate what the best breakpoints should be
				breakpoints: {
					medium: '130rem',
					large: '130rem',
				},
				codeBlock: {
					borderRadius: 4,
				},
				...colorsGenerated,
			},
		};
	}, []);

	return <Redoc {...specProps} optionsOverrides={optionsOverrides} />;
};

const colorsGenerated = {
	colors: {
		accent: {
			main: '#59C3FF',
			light: '#b3dcf3',
			dark: '#033B73',
			contrastText: '#ffffff',
		},
		border: {
			dark: '#616E7C',
			light: '#D9CBA3',
		},
		error: {
			contrastText: '#ffffff',
			dark: '#9B0000',
			light: '#FF4C4C',
			main: '#CC0000',
		},
		http: {
			basic: '#707070',
			delete: '#C83637',
			get: '#3A9601',
			head: '#A23DAD',
			link: '#07818F',
			options: '#947014',
			patch: '#bf581d',
			post: '#0065FB',
			put: '#93527B',
		},
		primary: {
			contrastText: '#ffffff',
			dark: '#603B56',
			light: '#B789A7',
			main: '#855b7c',
		},
		responses: {
			error: {
				backgroundColor: '#B35454',
				borderColor: '#FFC9C9',
				color: '#FBEFEF',
				tabTextColor: '#B35454',
			},
			info: {
				backgroundColor: '#487F9F',
				borderColor: '#9CCFF9',
				color: '#D8EEF6',
				tabTextColor: '#487F9F',
			},
			redirect: {
				backgroundColor: '#B38E26',
				borderColor: '#F9D078',
				color: '#FDF8E4',
				tabTextColor: '#B38E26',
			},
			success: {
				backgroundColor: '#386434',
				borderColor: '#B1E996',
				color: '#DFF8DB',
				tabTextColor: '#386434',
			},
		},
		secondary: {
			main: '#D9CBA3',
			light: '#EFD9C6',
			contrastText: '#3E4C59',
			success: {
				contrastText: '#ffffff',
				dark: '#1C7119',
				light: '#57B67A',
				main: '#228B22',
			},
		},
		text: {
			// primary: '#1F2933', // dont work nice
			secondary: '#7b8794',
			light: '#D9CBA3',
		},
		tonalOffset: 0.2,
		warning: {
			contrastText: '#ffffff',
			dark: '#B37A00',
			light: '#FFCC40',
			main: '#FFAA00',
		},
	},
	typography: {
		code: {
			color: 'rgb(0,0,0)',
			backgroundColor: 'rgba(255,255,255, 0.35)',
		},
	},
};

export default ApiDocMdxModified;
