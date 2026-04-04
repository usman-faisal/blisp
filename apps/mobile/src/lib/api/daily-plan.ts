/**
 * Mock upload function — replace with a real multipart/form-data upload
 * to your backend when the endpoint is ready.
 */
export async function uploadAudioBrainDump(uri: string): Promise<{ success: boolean }> {
  console.log('[uploadAudioBrainDump] Uploading recording:', uri);

  // Simulate upload latency
  await new Promise((r) => setTimeout(r, 1200));

  console.log('[uploadAudioBrainDump] Upload complete');
  return { success: true };
}
