/** Turn Zod's technical messages into short field-level messages. */
export function friendlyMessage(message: string): string {
  const range = /^Too (small|big): expected number to be (>=|>|<=|<)\s*(-?[\d.e+]+)/.exec(message);
  if (range) {
    const [, , op, n] = range;
    const word = { ">=": "at least", ">": "more than", "<=": "at most", "<": "less than" }[op];
    return `Must be ${word} ${Number(n).toLocaleString("en-US")}`;
  }
  if (/received undefined/i.test(message)) return "Required";
  if (/expected number/i.test(message)) return "Enter a number";
  return message;
}
