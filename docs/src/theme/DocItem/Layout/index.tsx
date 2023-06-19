import React from 'react';
import clsx from 'clsx';
import { useWindowSize } from '@docusaurus/theme-common';
import { useDoc } from '@docusaurus/theme-common/internal';
import DocItemPaginator from '@theme/DocItem/Paginator';
import DocVersionBanner from '@theme/DocVersionBanner';
import DocVersionBadge from '@theme/DocVersionBadge';
import DocItemFooter from '@theme/DocItem/Footer';
import DocItemTOCMobile from '@theme/DocItem/TOC/Mobile';
import DocItemTOCDesktop from '@theme/DocItem/TOC/Desktop';
import DocItemContent from '@theme/DocItem/Content';
import type { Props } from '@theme/DocItem/Layout';

import styles from './styles.module.scss';

/**
 * Decide if the toc should be rendered, on mobile or desktop viewports
 */
function useDocTOC() {
	const { frontMatter, toc } = useDoc();

	const windowSize = useWindowSize();

	const hidden = frontMatter.hide_table_of_contents;
	const canRender = !hidden && toc.length > 0;

	const mobile = canRender ? <DocItemTOCMobile /> : undefined;

	const desktop =
		canRender && (windowSize === 'desktop' || windowSize === 'ssr') ? (
			<DocItemTOCDesktop />
		) : undefined;

	return {
		hidden,
		mobile,
		desktop,
	};
}

export default function DocItemLayout({ children }: Props): JSX.Element {
	const docTOC = useDocTOC();
	// CUSTOM CODE
	const { frontMatter } = useDoc();
	const isAPI = frontMatter.api_page === true;
	// END CUSTOM CODE

	return (
		<div className="row">
			{/* CUSTOM CODE */}
			{/*<div className={clsx('col', !docTOC.hidden && styles.docItemCol)}>*/}
			<div
				className={clsx(
					!isAPI ? clsx('col', !docTOC.hidden && styles.docItemCol) : styles.api
				)}
			>
				{/* END CUSTOM CODE */}
				<DocVersionBanner />
				<div className={styles.docItemContainer}>
					<article>
						{/* CUSTOM CODE - Removing breadcrumbs */}
						{/*<DocBreadcrumbs />*/}
						{/* ---- */}
						<DocVersionBadge />
						{docTOC.mobile}
						<DocItemContent>{children}</DocItemContent>
						<DocItemFooter />
					</article>
					{/* CUSTOM CODE - adding wrapper around paginator */}
					<div className={clsx(isAPI && 'ml-2')}>
						<DocItemPaginator />
					</div>
					{/*	--- */}
				</div>
			</div>
			{/* CUSTOM CODE*/}
			{/*{docTOC.desktop && <div className="col col--3">{docTOC.desktop}</div>}*/}
			{docTOC.desktop && !docTOC.hidden && (
				<div className="end">{docTOC.desktop}</div>
			)}
			{/* -------- */}
		</div>
	);
}
