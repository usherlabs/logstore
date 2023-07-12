// Ported from https://github.com/soldair/node-buffer-indexof/blob/master/index.js
export const bufferIndexOf = (
	buff: Buffer,
	search: Buffer,
	offset = 0,
	encoding = 'utf8'
) => {
	if (!Buffer.isBuffer(buff)) {
		throw TypeError('buffer is not a buffer');
	}

	// allow optional offset when providing an encoding
	if (encoding === undefined && typeof offset === 'string') {
		encoding = offset;
		offset = undefined;
	}

	if (search.length === 0) {
		return -1;
	}

	if (offset < 0) {
		offset = buff.length + offset;
	}

	if (offset < 0) {
		offset = 0;
	}

	let m = 0;
	let s = -1;

	for (let i = offset; i < buff.length; ++i) {
		if (buff[i] != search[m]) {
			s = -1;
			// <-- go back
			// match abc to aabc
			// 'aabc'
			// 'aab'
			//    ^ no match
			// a'abc'
			//   ^ set index here now and look at these again.
			//   'abc' yay!
			i -= m - 1;
			m = 0;
		}

		if (buff[i] == search[m]) {
			if (s == -1) {
				s = i;
			}
			++m;
			if (m == search.length) {
				break;
			}
		}
	}

	if (s > -1 && buff.length - s < search.length) {
		return -1;
	}
	return s;
};

// Ported from https://github.com/soldair/node-buffer-split/blob/master/index.js
export const bufferSplit = (
	buf: Buffer,
	splitBuf: Buffer,
	includeDelim = false
): Buffer[] => {
	let search = -1;
	const lines: Buffer[] = [];
	const move = includeDelim ? splitBuf.length : 0;

	while ((search = bufferIndexOf(buf, splitBuf)) > -1) {
		lines.push(buf.subarray(0, search + move));
		buf = buf.subarray(search + splitBuf.length, buf.length);
	}

	lines.push(buf);

	return lines;
};
