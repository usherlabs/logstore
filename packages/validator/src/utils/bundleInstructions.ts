import { Bundle } from '@kyve/core';
import { SubmitInstruction } from '@/types';

export const getBundleInstructions = (bundleProposal: Bundle) => {
	return bundleProposal.bundle
		.filter(
			(item) =>
				item.value.type === 'transform' &&
				typeof item.value.out === 'object' &&
				typeof item.value.out?.submit === 'object'
		)
		.map((item) => item.value.out.submit) as SubmitInstruction[];
};
