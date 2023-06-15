import React from "react";
import clsx from "clsx";
import { ThemeClassNames } from "@docusaurus/theme-common";
import { type DocContextValue, useDoc } from "@docusaurus/theme-common/internal";
import LastUpdated from "@theme/LastUpdated";
import EditThisPage from "@theme/EditThisPage";
import TagsListInline, { type Props as TagsListInlineProps } from "@theme/TagsListInline";

import styles from "./styles.module.css";

function TagsRow(props: TagsListInlineProps) {
	return (
		<div
			className={clsx(
				ThemeClassNames.docs.docFooterTagsRow,
				"row margin-bottom--sm"
			)}>
			<div className="col">
				<TagsListInline {...props} />
			</div>
		</div>
	);
}

type EditMetaRowProps = Pick<
	DocContextValue["metadata"],
	"editUrl" | "lastUpdatedAt" | "lastUpdatedBy" | "formattedLastUpdatedAt"
>;

function EditMetaRow({
											 editUrl,
											 lastUpdatedAt,
											 lastUpdatedBy,
											 formattedLastUpdatedAt
										 }: EditMetaRowProps) {
	return (
		<div className={clsx(ThemeClassNames.docs.docFooterEditMetaRow, "row")}>
			<div className="col">{editUrl && <EditThisPage editUrl={editUrl} />}</div>

			<div className={clsx("col", styles.lastUpdated)}>
				{(lastUpdatedAt || lastUpdatedBy) && (
					<LastUpdated
						lastUpdatedAt={lastUpdatedAt}
						formattedLastUpdatedAt={formattedLastUpdatedAt}
						lastUpdatedBy={lastUpdatedBy}
					/>
				)}
			</div>
		</div>
	);
}

export default function DocItemFooter(): JSX.Element | null {
	// CUSTOM CODE - detect if is api page
	const { metadata, frontMatter } = useDoc();
	const { editUrl, lastUpdatedAt, formattedLastUpdatedAt, lastUpdatedBy, tags } =
		metadata;
	const { api_page } = frontMatter;
	const isAPI = api_page === true;
	console.log({api_page})
	// END CUSTOM CODE

	const canDisplayTagsRow = tags.length > 0;
	const canDisplayEditMetaRow = !!(editUrl || lastUpdatedAt || lastUpdatedBy);

	const canDisplayFooter = canDisplayTagsRow || canDisplayEditMetaRow;

	if (!canDisplayFooter) {
		return null;
	}

	return (
		// CUSTOM CODE - add margin if is api page
		<footer
			className={clsx( isAPI && "ml-6", ThemeClassNames.docs.docFooter, "docusaurus-mt-lg")}>
			{canDisplayTagsRow && <TagsRow tags={tags} />}
			{canDisplayEditMetaRow && (
				<EditMetaRow
					editUrl={editUrl}
					lastUpdatedAt={lastUpdatedAt}
					lastUpdatedBy={lastUpdatedBy}
					formattedLastUpdatedAt={formattedLastUpdatedAt}
				/>
			)}
		</footer>
	);
}
