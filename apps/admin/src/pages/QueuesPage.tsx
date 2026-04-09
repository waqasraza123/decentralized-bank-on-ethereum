import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  getReviewCaseWorkspace,
  listPendingAccountReleaseReviews,
  listReviewCases
} from "@/lib/api";
import { formatDateTime, formatName, shortenValue, toTitleCase } from "@/lib/format";
import { SectionPanel, EmptyState } from "@/components/console/primitives";
import { useConfiguredSessionGuard } from "./shared";

export function QueuesPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedReviewCaseId = searchParams.get("reviewCase");

  const reviewCasesQuery = useQuery({
    queryKey: ["review-cases", session?.baseUrl],
    queryFn: () => listReviewCases(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const accountReleaseReviewsQuery = useQuery({
    queryKey: ["account-release-reviews", session?.baseUrl],
    queryFn: () => listPendingAccountReleaseReviews(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const reviewWorkspaceQuery = useQuery({
    queryKey: ["review-workspace", session?.baseUrl, selectedReviewCaseId],
    queryFn: () => getReviewCaseWorkspace(session!, selectedReviewCaseId!, 10),
    enabled: Boolean(session && selectedReviewCaseId)
  });

  useEffect(() => {
    const firstId = reviewCasesQuery.data?.reviewCases[0]?.id;
    if (firstId && !selectedReviewCaseId) {
      setSearchParams({ reviewCase: firstId });
    }
  }, [reviewCasesQuery.data, selectedReviewCaseId, setSearchParams]);

  if (fallback) {
    return fallback;
  }

  if (reviewCasesQuery.isLoading || accountReleaseReviewsQuery.isLoading) {
    return <p>Loading queues...</p>;
  }

  if (reviewCasesQuery.isError || accountReleaseReviewsQuery.isError) {
    return <p>Failed to load queue state.</p>;
  }

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Operational queues"
        description="Review work, release requests, and the currently selected case workspace."
      >
        <div className="admin-split-layout">
          <div className="admin-list-card">
            <h3>Review cases</h3>
            <div className="admin-list">
              {reviewCasesQuery.data!.reviewCases.map((reviewCase) => (
                <button
                  key={reviewCase.id}
                  type="button"
                  className={`admin-list-row selectable ${
                    selectedReviewCaseId === reviewCase.id ? "selected" : ""
                  }`}
                  onClick={() => setSearchParams({ reviewCase: reviewCase.id })}
                >
                  <strong>{formatName(reviewCase.customer.firstName, reviewCase.customer.lastName)}</strong>
                  <span>{toTitleCase(reviewCase.status)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="admin-list-card">
            <h3>Selected workspace</h3>
            {reviewWorkspaceQuery.data ? (
              <div className="admin-detail-stack">
                <p>
                  <strong>Case:</strong> {reviewWorkspaceQuery.data.reviewCase.id}
                </p>
                <p>
                  <strong>Customer:</strong>{" "}
                  {formatName(
                    reviewWorkspaceQuery.data.reviewCase.customer.firstName,
                    reviewWorkspaceQuery.data.reviewCase.customer.lastName
                  )}
                </p>
                <p>
                  <strong>Status:</strong> {toTitleCase(reviewWorkspaceQuery.data.reviewCase.status)}
                </p>
                <p>
                  <strong>Reason:</strong>{" "}
                  {reviewWorkspaceQuery.data.reviewCase.reasonCode ?? "None"}
                </p>
                <p>
                  <strong>Recent events:</strong> {reviewWorkspaceQuery.data.caseEvents.length}
                </p>
              </div>
            ) : (
              <EmptyState
                title="Select a review case"
                description="Choose a queue item to inspect balances, notes, and recent audit context."
              />
            )}
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Release reviews"
        description="Pending account hold release decisions waiting on operator action."
      >
        <div className="admin-list-card">
          <div className="admin-list">
            {accountReleaseReviewsQuery.data!.reviews.map((review) => (
              <div key={review.reviewCase.id} className="admin-list-row">
                <strong>{review.customer.email}</strong>
                <span>{review.restriction.releaseDecisionStatus}</span>
                <span>{shortenValue(review.oversightIncident.id)}</span>
                <span>{formatDateTime(review.restriction.releaseRequestedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}
