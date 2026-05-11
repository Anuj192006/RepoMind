export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    
    await new Promise(resolve => setTimeout(resolve, delay));
    console.log(`Retrying operation... ${retries} attempts left`);
    
    return withRetry(fn, retries - 1, delay * 2);
  }
}
