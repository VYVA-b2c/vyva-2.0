export type TriageHandoffAuthorizationInput = {
  shareWithSavedContacts?: boolean;
  requestStaffReview?: boolean;
};

export function resolveTriageHandoffAuthorization(input: TriageHandoffAuthorizationInput) {
  return {
    shareWithSavedContacts: input.shareWithSavedContacts === true,
    staffReviewRequested: input.requestStaffReview === true,
  };
}
