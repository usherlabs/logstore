# **NPM Publish Guide**

## **Introduction**

**`changeset`** is an effective build tool designed for both multi-package and single-package repositories. It streamlines the process of versioning and publishing your code. For comprehensive information and guidance, refer to the [Changesets Repository](https://github.com/changesets/changesets).

Familiarize yourself with Changeset by exploring the [Common Questions](https://github.com/changesets/changesets/blob/main/docs/common-questions.md) section in their documentation.

## **Configuration File Explained**

- **`fixed`**: This keyword groups packages together. When one is updated, all in the group are updated to the same version.
- **`ignored`**: These are packages excluded from being bumped, even if they depend on an updated package.
- **`ignored` and Publishing**: The **`ignored`** setting doesn't influence the publishing process to npm. However, packages with **`private: true`** in their **`package.json`** will be automatically excluded from publishing.

## **Publishing Release Workflow**

Before starting, ensure you have a clean git state. This helps in accurately identifying and committing package bumps.

1. **Creating a Changeset**

	```bash
	pnpm changeset
	```

    - Choose packages needing detailed changelogs. Others will simply note "dependencies updated".
    - Modify the generated changeset file if necessary.

2. **Version Bumping**

	```bash
	pnpm version
	```

    - This step updates all relevant **`package.json`** files and amends changelogs.

3. **Publishing Changes**

	```bash
	pnpm publish
	```

    - Publishes new versions to npm, omitting packages marked as **`private: true`**.

After these steps, remember to commit the changes, including the generated git tags.

## **Testing a Release on NPM with Snapshot**

To test a release, use the snapshot feature detailed in [Snapshot Releases Documentation](https://github.com/changesets/changesets/blob/main/docs/snapshot-releases.md).

 This process publishes a version like **`0.0.0-dev-{TIMESTAMP}`** under the npm **`dev`** tag.


1. Create a changeset normally:

	```bash
	pnpm changeset
	```

2. Version bump for a snapshot:

	```bash
	pnpm changeset version --snapshot dev
	```

3. Publish with a specific tag, avoiding git tags:

	```bash
	pnpm changeset publish --tag=dev --no-git-tag
	```

- IMPORTANT: `--tag=dev` is necessary so that it doesn't publish as latest tag
- Use **`-no-git-tag`** to prevent cluttering your repo history.

## **Publishing a Pre-release (Future Implementation)**

This section is reserved for future instructions on managing separate branches or releases, such as **`beta`** or **`rc`** versions.
