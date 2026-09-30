package com.ipomanager.dto;

import com.ipomanager.model.Transaction;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Flat transaction view model for the API: both parties are exposed as
 * id + name pairs (a null id means you, "Me"), and field names match the
 * frontend contract ({@code date}, {@code notes}).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TransactionDto {

    private Long id;
    /** Null when the sender is you. */
    private Long senderId;
    private String senderName;
    /** Null when the receiver is you. */
    private Long receiverId;
    private String receiverName;
    private Long ipoId;
    private String ipoName;
    private BigDecimal amount;
    private String mode; // UPI | GPAY | CASH | BANK | SELF
    private LocalDateTime date;
    private boolean settled;
    private LocalDateTime settledAt;
    private String notes;
    /** Id of the original transaction, when this leg is a return. */
    private Long returnOfId;
    /** Lifecycle status: SENT | UNALLOCATED | ALLOCATED | SETTLED_UNALLOCATED | SETTLED_SOLD. */
    private String status;
    /** Realized profit (+) / loss (−) vs the sent amount, set when settled after a sale. */
    private BigDecimal profitLoss;
    /**
     * Amount of this debt leg still owed (0 when settled or fully
     * returned; always 0 for return legs). Filled by the service layer —
     * {@link #from(Transaction)} leaves it null.
     */
    private BigDecimal outstanding;
    /**
     * True when the leg is struck off (settled or fully returned).
     * Filled by the service layer.
     */
    private boolean struck;

    public static TransactionDto from(Transaction t) {
        TransactionDto dto = new TransactionDto();
        dto.setId(t.getId());
        dto.setSenderId(t.getSenderPerson() == null
                ? null : t.getSenderPerson().getId());
        dto.setSenderName(t.getSenderName());
        dto.setReceiverId(t.getReceiverPerson() == null
                ? null : t.getReceiverPerson().getId());
        dto.setReceiverName(t.getReceiverName());
        dto.setIpoId(t.getIpo().getId());
        dto.setIpoName(t.getIpo().getName());
        dto.setAmount(t.getAmount());
        dto.setMode(t.getMode() == null ? null : t.getMode().name());
        dto.setDate(t.getTxnDate());
        dto.setSettled(t.isSettled());
        dto.setSettledAt(t.getSettledAt());
        dto.setNotes(t.getRemarks());
        dto.setReturnOfId(t.getReturnOf() == null
                ? null : t.getReturnOf().getId());
        dto.setStatus(t.getStatus() == null ? null : t.getStatus().name());
        dto.setProfitLoss(t.getProfitLoss());
        return dto;
    }
}
