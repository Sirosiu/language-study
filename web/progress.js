export const CODES = Object.freeze(['ar','da','nl','en','fi','fr','de','ka','it','ja','ko','zh','ru','es','tr']);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (id, code, kind) => typeof id === 'string' && new RegExp(`^${code}-${kind}(?:0[0-9]{3}|1000)$`).test(id) && !id.endsWith('0000');

// Copy only known identifiers and values; never merge untrusted object keys.
export function sanitiseProgress(input) {
  if (!record(input)) throw new Error('Choose a progress JSON file exported by this course.');
  const wrapped = Object.hasOwn(input, 'schemaVersion');
  if (wrapped && input.schemaVersion !== 1) throw new Error('This progress file uses an unsupported version.');
  const data = wrapped ? input.progress : input;
  if (!record(data)) throw new Error('The file does not contain study progress.');
  const result = {};
  for (const code of Object.keys(data)) {
    if (!CODES.includes(code)) throw new Error('The file contains an unknown language.');
    const entry = data[code];
    if (!record(entry) || !record(entry.attempts) || !Array.isArray(entry.words)) throw new Error('A language has invalid progress data.');
    const attempts = {};
    for (const [id, mark] of Object.entries(entry.attempts)) {
      if (!validId(id, code, 'Q') || !['correct','review'].includes(mark)) throw new Error('The file contains an invalid question or mark.');
      attempts[id] = mark;
    }
    if (entry.words.some(id => !validId(id, code, 'V'))) throw new Error('The file contains an invalid saved word.');
    result[code] = { attempts, words: [...new Set(entry.words)] };
  }
  return result;
}

export function mergeProgress(current, incoming) {
  const result = sanitiseProgress(current);
  for (const [code, value] of Object.entries(sanitiseProgress(incoming))) {
    const previous = result[code] || { attempts: {}, words: [] };
    result[code] = { attempts: { ...previous.attempts, ...value.attempts }, words: [...new Set([...previous.words, ...value.words])] };
  }
  return result;
}

export function progressEnvelope(progress) {
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), progress: sanitiseProgress(progress) };
}
