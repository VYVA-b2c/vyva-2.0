/**
 * Visual evidence is processed for the current review, but new raw images are
 * not retained in scan history. The structured review remains available.
 */
export function nonRetainedShowVyvaEvidence() {
  return { image_data: null } as const;
}
