package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

/**
 * The complete picture of one IPO: applications with who funded each,
 * allotment counts, and the money ledger (who sent to whom, what is
 * still owed). Backs the IPO detail screen.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class IpoSummaryDto {

    private Long ipoId;
    private String ipoName;
    private String status;
    private int applicationCount;
    private int allottedCount;
    private int notAllottedCount;
    private BigDecimal appliedTotal;
    /** Every movement for this IPO, newest first (struck-off included). */
    private List<TransactionDto> transactions;
    /** Outstanding debts for this IPO: who owes whom, how much. */
    private List<DebtDto> outstanding;
    /** One entry per application, with the money that funded it. */
    private List<ApplicationFundingDto> applications;
    private BigDecimal receivedTotal;
    private BigDecimal outstandingTotal;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DebtDto {
        /** Null id means you. */
        private Long senderId;
        private String senderName;
        private Long receiverId;
        private String receiverName;
        /** Amount the receiver still owes the sender. */
        private BigDecimal amount;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ApplicationFundingDto {
        private ApplicationDto application;
        /** Who funded this person's application, and how much is still owed to each. */
        private List<FunderDto> funders;
        private BigDecimal fundedTotal;
        private BigDecimal outstandingTotal;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FunderDto {
        /** Null id means you. */
        private Long funderId;
        private String funderName;
        private BigDecimal amount;
        private BigDecimal outstanding;
    }
}
