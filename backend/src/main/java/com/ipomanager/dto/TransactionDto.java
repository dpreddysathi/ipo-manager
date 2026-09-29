package com.ipomanager.dto;

import com.ipomanager.model.Transaction;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Flat transaction view model for the API: related person/IPO are exposed
 * as id + name pairs instead of nested entities, and field names match the
 * frontend contract ({@code date}, {@code notes}).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TransactionDto {

    private Long id;
    private Long personId;
    private String personName;
    private Long ipoId;
    private String ipoName;
    private String direction; // RECEIVED | SENT
    private BigDecimal amount;
    private String mode; // UPI | GPAY | CASH | BANK | SELF
    private LocalDateTime date;
    private boolean settled;
    private LocalDateTime settledAt;
    private String notes;
    /** Who the money came from (source account / person). */
    private String sender;
    /** Who the money went to (destination account / person). */
    private String receiver;
    /** Lifecycle status: SENT | UNALLOCATED | ALLOCATED | SETTLED_UNALLOCATED | SETTLED_SOLD. */
    private String status;
    /** Realized profit (+) / loss (−) vs the sent amount, set when settled after a sale. */
    private BigDecimal profitLoss;

    public static TransactionDto from(Transaction t) {
        return new TransactionDto(
                t.getId(),
                t.getPerson().getId(),
                t.getPerson().getName(),
                t.getIpo().getId(),
                t.getIpo().getName(),
                t.getDirection().name(),
                t.getAmount(),
                t.getMode().name(),
                t.getTxnDate(),
                t.isSettled(),
                t.getSettledAt(),
                t.getRemarks(),
                t.getSender(),
                t.getReceiver(),
                t.getStatus() == null ? null : t.getStatus().name(),
                t.getProfitLoss());
    }
}
