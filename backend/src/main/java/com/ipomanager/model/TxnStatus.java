package com.ipomanager.model;

/**
 * Lifecycle of a money transaction for an IPO.
 *
 * <ul>
 *   <li>{@code SENT} — money sent / applied, in flight (default).</li>
 *   <li>{@code UNALLOCATED} — the IPO did not allot; money is due back.</li>
 *   <li>{@code ALLOCATED} — the IPO allotted shares for this money.</li>
 *   <li>{@code SETTLED_UNALLOCATED} — closed: money returned after
 *       non-allocation (refund).</li>
 *   <li>{@code SETTLED_SOLD} — closed: allocated, shares sold, realized
 *       profit/loss recorded on the transaction.</li>
 * </ul>
 */
public enum TxnStatus {
    SENT,
    UNALLOCATED,
    ALLOCATED,
    SETTLED_UNALLOCATED,
    SETTLED_SOLD;

    /** True once the money loop is closed (either settled variant). */
    public boolean isSettled() {
        return this == SETTLED_UNALLOCATED || this == SETTLED_SOLD;
    }
}
