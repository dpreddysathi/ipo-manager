package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** Stat cards for the dashboard (§4.6 of the spec). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DashboardStatsDto {

    /** IPOs with status OPEN. */
    private long activeIpos;

    /** Total received by you across all debt legs. */
    private BigDecimal moneyReceived;

    private long peopleCount;

    /** Outstanding: you still owe other people. */
    private BigDecimal youOwe;

    /** Outstanding: other people still owe you. */
    private BigDecimal owedToYou;

    /** Outstanding person-to-person debts where you are neither side. */
    private PendingSettlements pendingSettlements;

    /** ALLOTTED ÷ total applications created this year, 0–100 (0 if none). */
    private double allotmentRateYtd;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PendingSettlements {
        private long count;
        private BigDecimal amount;
    }
}
