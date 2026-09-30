package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Outcome of one PAN-based allotment lookup against a registrar.
 * The PAN itself is never included — it is sensitive and only travels
 * from the encrypted KYC store to the registrar over HTTPS.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AllotmentCheckResult {

    public enum Outcome {
        /** Registrar confirms shares were allotted. */
        ALLOTTED,
        /** Application found on this PAN, but zero shares allotted. */
        NOT_ALLOTTED,
        /** No application found for this PAN (or allotment not yet declared). */
        NOT_FOUND,
        /** Person has no PAN on file — nothing to check with. */
        NEED_PAN,
        /** Registrar needs a captcha (BSE/NSE/Bigshare) — check manually. */
        MANUAL,
        /** Registrar unreachable or returned something unrecognized. */
        ERROR
    }

    private Long applicationId;
    private Outcome outcome;
    /** Shares allotted, when the registrar reports a count. */
    private Integer allottedShares;
    /** Human-readable note, e.g. the manual-check URL or error detail. */
    private String message;

    public static AllotmentCheckResult of(Long applicationId, Outcome outcome, String message) {
        return new AllotmentCheckResult(applicationId, outcome, null, message);
    }
}
