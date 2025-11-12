// Simple wait function
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitFor(conditional: () => boolean) {
  while (!conditional()) {
    await wait(5)
  }
  return
}
