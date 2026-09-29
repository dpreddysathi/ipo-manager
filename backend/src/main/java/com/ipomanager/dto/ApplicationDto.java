package com.ipomanager.dto;

import com.ipomanager.model.Application;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Flat application view model for the API: related person/IPO are exposed
 * as id + name pairs, and monetary fields use the frontend's names
 * ({@code amount}, {@code refund}) with {@code appliedDate} for the record's
 * creation time.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ApplicationDto {

    private Long id;
    private Long personId;
    private String personName;
    private Long ipoId;
    private String ipoName;
    private BigDecimal amount;
    private String status; // APPLIED | ALLOTTED | NOT_ALLOTTED | REFUNDED
    private LocalDateTime appliedDate;
    private String allottedBy;
    private LocalDateTime allottedAt;
    private BigDecimal refund;
    private BigDecimal profitLoss;
    private LocalDateTime soldAt;
    private String remarks;

    public static ApplicationDto from(Application a) {
        return new ApplicationDto(
                a.getId(),
                a.getPerson().getId(),
                a.getPerson().getName(),
                a.getIpo().getId(),
                a.getIpo().getName(),
                a.getAppliedAmount(),
                a.getStatus() != null ? a.getStatus().name() : null,
                a.getCreatedAt(),
                a.getAllottedBy(),
                a.getAllottedAt(),
                a.getRefundAmount(),
                a.getProfitLoss(),
                a.getSoldAt(),
                a.getRemarks());
    }
}
